import { BadRequestException } from '@nestjs/common';
import { PurchaseOrderEngine } from './purchase-order-engine.service';

describe('PurchaseOrderEngine', () => {
  const engine = new PurchaseOrderEngine();

  describe('assertAction (state machine)', () => {
    it('cho phép duyệt và xác nhận từ DRAFT', () => {
      expect(() => engine.assertAction('approve', 'DRAFT')).not.toThrow();
      expect(() => engine.assertAction('confirm', 'DRAFT')).not.toThrow();
    });

    it('cho phép xác nhận từ APPROVED nhưng không cho duyệt lại', () => {
      expect(() => engine.assertAction('confirm', 'APPROVED')).not.toThrow();
      expect(() => engine.assertAction('approve', 'APPROVED')).toThrow(
        BadRequestException,
      );
    });

    it('không cho hủy phiếu DRAFT (phải xóa, đúng hành vi v1)', () => {
      expect(() => engine.assertAction('cancel', 'DRAFT')).toThrow(
        BadRequestException,
      );
    });

    it('không cho hủy phiếu đã nhận đủ hàng', () => {
      expect(() => engine.assertAction('cancel', 'RECEIVED')).toThrow(
        BadRequestException,
      );
    });

    it('cho hủy từ CONFIRMED và PARTIAL_RECEIVED (việc phụ thuộc kiểm ở service)', () => {
      expect(() => engine.assertAction('cancel', 'CONFIRMED')).not.toThrow();
      expect(() =>
        engine.assertAction('cancel', 'PARTIAL_RECEIVED'),
      ).not.toThrow();
    });

    it('trả trạng thái đích đúng cho từng hành động', () => {
      expect(engine.targetOf('approve')).toBe('APPROVED');
      expect(engine.targetOf('confirm')).toBe('CONFIRMED');
      expect(engine.targetOf('cancel')).toBe('CANCELLED');
    });
  });

  describe('assertHeaderEditable', () => {
    it('chặn sửa khi RECEIVED hoặc CANCELLED', () => {
      expect(() => engine.assertHeaderEditable('RECEIVED')).toThrow(
        BadRequestException,
      );
      expect(() => engine.assertHeaderEditable('CANCELLED')).toThrow(
        BadRequestException,
      );
    });

    it('cho sửa khi DRAFT, APPROVED, CONFIRMED, PARTIAL_RECEIVED', () => {
      for (const status of [
        'DRAFT',
        'APPROVED',
        'CONFIRMED',
        'PARTIAL_RECEIVED',
      ]) {
        expect(() => engine.assertHeaderEditable(status)).not.toThrow();
      }
    });
  });

  describe('normalizeLine (#8: kiểm dương, tính lại amount)', () => {
    it('tính amount = qty × price ở server, bỏ qua số client gửi', () => {
      const line = engine.normalizeLine({
        qtyOrdered: '2',
        unitPrice: '1500.5',
      });
      expect(line).toEqual({
        qtyOrdered: '2.000',
        unitPrice: '1500.500',
        amount: '3001.000',
      });
    });

    it('cho phép đơn giá rỗng, amount = 0', () => {
      const line = engine.normalizeLine({ qtyOrdered: '3', unitPrice: null });
      expect(line.unitPrice).toBeNull();
      expect(line.amount).toBe('0.000');
    });

    it('từ chối số lượng <= 0 hoặc không phải số', () => {
      expect(() => engine.normalizeLine({ qtyOrdered: '0' })).toThrow(
        BadRequestException,
      );
      expect(() => engine.normalizeLine({ qtyOrdered: '-1' })).toThrow(
        BadRequestException,
      );
      expect(() => engine.normalizeLine({ qtyOrdered: 'abc' })).toThrow(
        BadRequestException,
      );
    });

    it('từ chối đơn giá âm', () => {
      expect(() =>
        engine.normalizeLine({ qtyOrdered: '1', unitPrice: '-5' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertLinesEditable (H2: không sửa dòng làm lệch đã nhận)', () => {
    it('cho sửa khi chưa có nhận hàng', () => {
      expect(() =>
        engine.assertLinesEditable(
          [{ qtyReceived: '0' }],
          [{ qtyOrdered: '1.000' }],
        ),
      ).not.toThrow();
    });

    it('chặn đặt SL nhỏ hơn SL đã nhận', () => {
      expect(() =>
        engine.assertLinesEditable(
          [{ qtyReceived: '5' }],
          [{ qtyOrdered: '3.000' }],
        ),
      ).toThrow(BadRequestException);
    });

    it('cho phép đặt SL bằng đúng SL đã nhận', () => {
      expect(() =>
        engine.assertLinesEditable(
          [{ qtyReceived: '5' }],
          [{ qtyOrdered: '5.000' }],
        ),
      ).not.toThrow();
    });

    it('chặn xóa dòng đã có SL nhận', () => {
      expect(() =>
        engine.assertLinesEditable(
          [{ qtyReceived: '2' }, { qtyReceived: '4' }],
          [{ qtyOrdered: '2.000' }],
        ),
      ).toThrow(BadRequestException);
    });

    it('cho xóa dòng chưa nhận hàng', () => {
      expect(() =>
        engine.assertLinesEditable(
          [{ qtyReceived: '2' }, { qtyReceived: '0' }],
          [{ qtyOrdered: '2.000' }],
        ),
      ).not.toThrow();
    });
  });

  describe('totalOf / deriveInventoryStatus / statusAfterReceipt', () => {
    it('cộng amount, làm tròn 3 chữ số, bỏ qua null', () => {
      expect(
        engine.totalOf([
          { amount: '100.500' },
          { amount: null },
          { amount: '0.250' },
        ]),
      ).toBe(100.75);
    });

    it('ánh xạ trạng thái nhận hàng khớp v1', () => {
      expect(engine.deriveInventoryStatus('RECEIVED')).toBe('RECEIVED');
      expect(engine.deriveInventoryStatus('FULLY_RECEIVED')).toBe('RECEIVED');
      expect(engine.deriveInventoryStatus('PARTIAL_RECEIVED')).toBe(
        'PARTIAL_RECEIVED',
      );
      expect(engine.deriveInventoryStatus('CONFIRMED')).toBe('NOT_RECEIVED');
    });

    it('tính trạng thái sau nhận hàng: 0 → APPROVED/CONFIRMED, một phần → PARTIAL, đủ → RECEIVED', () => {
      expect(engine.statusAfterReceipt('CONFIRMED', 10, 0)).toBe('CONFIRMED');
      expect(engine.statusAfterReceipt('APPROVED', 10, 0)).toBe('APPROVED');
      expect(engine.statusAfterReceipt('CONFIRMED', 10, 4)).toBe(
        'PARTIAL_RECEIVED',
      );
      expect(engine.statusAfterReceipt('CONFIRMED', 10, 10)).toBe('RECEIVED');
    });
  });
});
