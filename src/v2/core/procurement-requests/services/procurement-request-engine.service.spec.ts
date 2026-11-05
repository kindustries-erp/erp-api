import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PURCHASE_REQUEST_TRANSITIONS,
  PURCHASE_REQUEST_STATUS,
} from '../contracts/procurement-requests.contract';
import { resolveTransition } from '../../approval/approval.engine';
import {
  assertCanCancel,
  assertLinesEditable,
  assertOrderable,
  assertValidDraftLines,
  estimatedTotalOf,
  remainingPoDraftLinesOf,
  orderingStatusOf,
} from './procurement-request-engine.service';

describe('procurement-request engine', () => {
  describe('bảng chuyển trạng thái', () => {
    it('gửi duyệt rồi duyệt đi từ DRAFT sang APPROVED', () => {
      const s1 = resolveTransition(
        PURCHASE_REQUEST_TRANSITIONS,
        'DRAFT',
        'submit',
      );
      expect(s1).toBe('PENDING_APPROVAL');
      expect(
        resolveTransition(PURCHASE_REQUEST_TRANSITIONS, s1, 'approve'),
      ).toBe('APPROVED');
    });

    it('từ chối và thu hồi đều đưa về DRAFT', () => {
      expect(
        resolveTransition(
          PURCHASE_REQUEST_TRANSITIONS,
          'PENDING_APPROVAL',
          'reject',
        ),
      ).toBe('DRAFT');
      expect(
        resolveTransition(
          PURCHASE_REQUEST_TRANSITIONS,
          'PENDING_APPROVAL',
          'recall',
        ),
      ).toBe('DRAFT');
    });

    it('không duyệt được khi chưa gửi', () => {
      expect(() =>
        resolveTransition(PURCHASE_REQUEST_TRANSITIONS, 'DRAFT', 'approve'),
      ).toThrow(ConflictException);
    });
  });

  describe('orderingStatusOf', () => {
    it('NONE khi chưa đặt dòng nào', () => {
      expect(orderingStatusOf([{ qtyRequested: 5, qtyOrdered: 0 }])).toBe(
        'NONE',
      );
    });

    it('PARTIAL khi đặt một phần', () => {
      expect(
        orderingStatusOf([
          { qtyRequested: 5, qtyOrdered: 2 },
          { qtyRequested: 3, qtyOrdered: 0 },
        ]),
      ).toBe('PARTIAL');
    });

    it('FULL khi mọi dòng đã đặt đủ, không bị lệch vì số thập phân', () => {
      expect(
        orderingStatusOf([
          { qtyRequested: 0.3, qtyOrdered: 0.1 + 0.2 },
          { qtyRequested: 2, qtyOrdered: 2 },
        ]),
      ).toBe('FULL');
    });
  });

  it('chỉ sửa dòng khi DRAFT', () => {
    expect(() => assertLinesEditable('DRAFT')).not.toThrow();
    expect(() => assertLinesEditable('PENDING_APPROVAL')).toThrow(
      ConflictException,
    );
  });

  it('không hủy được khi có dòng đã đặt', () => {
    expect(() => assertCanCancel([{ qtyRequested: 5, qtyOrdered: 1 }])).toThrow(
      ConflictException,
    );
    expect(() =>
      assertCanCancel([{ qtyRequested: 5, qtyOrdered: 0 }]),
    ).not.toThrow();
  });

  it('chặn đặt vượt phần còn lại và đặt từ PR chưa duyệt', () => {
    const line = { qtyRequested: 10, qtyOrdered: 7 };
    expect(() =>
      assertOrderable(PURCHASE_REQUEST_STATUS.APPROVED, line, 3),
    ).not.toThrow();
    expect(() =>
      assertOrderable(PURCHASE_REQUEST_STATUS.APPROVED, line, 4),
    ).toThrow(ConflictException);
    expect(() =>
      assertOrderable(PURCHASE_REQUEST_STATUS.DRAFT, line, 1),
    ).toThrow(ConflictException);
  });
});

describe('dòng đề nghị', () => {
  it('từ chối danh sách rỗng, loại dòng sai, số lượng không dương', () => {
    expect(() => assertValidDraftLines([])).toThrow(BadRequestException);
    expect(() =>
      assertValidDraftLines([{ lineType: 'OTHER', qtyRequested: 1 }]),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidDraftLines([{ lineType: 'GOODS', qtyRequested: 0 }]),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidDraftLines([{ lineType: 'SERVICE', qtyRequested: 2 }]),
    ).not.toThrow();
  });

  it('tổng ước tính làm tròn 2 chữ số, dòng không có giá tính 0', () => {
    expect(
      estimatedTotalOf([
        { lineType: 'GOODS', qtyRequested: 3, estUnitPrice: 0.1 },
        { lineType: 'SERVICE', qtyRequested: 1 },
      ]),
    ).toBe(0.3);
  });
});

describe('remainingPoDraftLinesOf', () => {
  const line = (over: Partial<Record<string, unknown>>) => ({
    id: 'l1',
    lineNo: 1,
    lineType: 'GOODS' as const,
    itemId: null,
    itemCode: null,
    itemName: null,
    description: null,
    qtyRequested: 10,
    qtyOrdered: 4,
    estUnitPrice: 5,
    ...over,
  });

  it('từ chối khi PR chưa APPROVED', () => {
    expect(() => remainingPoDraftLinesOf('DRAFT', [line({})] as any)).toThrow(
      ConflictException,
    );
  });

  it('chỉ trả dòng còn số lượng chưa đặt, sắp theo lineNo', () => {
    const out = remainingPoDraftLinesOf('APPROVED', [
      line({ id: 'b', lineNo: 2, qtyOrdered: 10 }),
      line({ id: 'a', lineNo: 1, qtyRequested: 10, qtyOrdered: 4 }),
    ] as any);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ requestLineId: 'a', qtyRemaining: 6 });
  });
});
