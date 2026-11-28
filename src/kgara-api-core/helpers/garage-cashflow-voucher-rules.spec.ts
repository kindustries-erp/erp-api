import { BadRequestException } from '@nestjs/common';

import {
  assertGarageVoucherRules,
  type GarageVoucherRuleState,
} from './garage-cashflow-voucher-rules';

const receipt = (
  patch: GarageVoucherRuleState = {},
): GarageVoucherRuleState => ({
  voucherType: 'RECEIPT',
  paymentStatus: 'PAID',
  amount: 100000,
  paymentMethod: 'Tiền mặt',
  paymentContent: '1. KH thanh toán',
  caseId: 'case-1',
  ...patch,
});

const payment = (
  patch: GarageVoucherRuleState = {},
): GarageVoucherRuleState => ({
  voucherType: 'PAYMENT',
  paymentStatus: 'PAID',
  amount: 100000,
  paymentMethod: 'Chuyển khoản khác',
  paymentContent: '9. Phụ tùng / vật tư',
  ...patch,
});

const check =
  (next: GarageVoucherRuleState, previous?: GarageVoucherRuleState) => () =>
    assertGarageVoucherRules(next, previous);

describe('assertGarageVoucherRules', () => {
  it('chấp nhận phiếu thu và phiếu chi hợp lệ', () => {
    expect(check(receipt())).not.toThrow();
    expect(check(payment())).not.toThrow();
  });

  describe('R1 số tiền', () => {
    it.each([0, -1, undefined, null, 'abc'])('chặn số tiền %s', (amount) => {
      expect(check(receipt({ amount }))).toThrow(BadRequestException);
    });

    it('chấp nhận số tiền dạng chuỗi từ cột numeric', () => {
      expect(check(receipt({ amount: '100000.00' }))).not.toThrow();
    });

    it('chặn cả khi chỉ sửa ghi chú', () => {
      const old = receipt({ amount: 0 });
      expect(check({ ...old, note: 'x' }, old)).toThrow('lớn hơn 0');
    });

    it('bỏ qua mọi luật khi hủy phiếu', () => {
      const old = receipt();
      expect(
        check({ ...old, amount: 0, paymentStatus: 'CANCELLED' }, old),
      ).not.toThrow();
    });
  });

  describe('R2 đã thu / đã chi', () => {
    it('chặn thiếu phương thức', () => {
      expect(check(receipt({ paymentMethod: ' ' }))).toThrow('phương thức');
    });

    it('chặn thiếu nội dung, kể cả phiếu thu cũ không có trạng thái', () => {
      expect(
        check(receipt({ paymentStatus: null, paymentContent: null })),
      ).toThrow('Phiếu đã thu phải có nội dung');
    });

    it('chặn phiếu chi cũ thiếu nội dung khi sửa ghi chú', () => {
      const old = payment({ paymentContent: '' });
      expect(check({ ...old, note: 'x' }, old)).toThrow(
        'Phiếu đã chi phải có nội dung',
      );
    });

    it('phiếu chưa chi không bắt buộc phương thức, nội dung', () => {
      expect(
        check(
          payment({
            paymentStatus: 'PENDING',
            paymentMethod: null,
            paymentContent: null,
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('R3 nội dung theo loại, phương thức trong danh sách', () => {
    it('chặn phiếu chi chọn BH thanh toán', () => {
      expect(check(payment({ paymentContent: '3. BH thanh toán' }))).toThrow(
        'không dùng cho phiếu chi',
      );
    });

    it('chặn phiếu thu chọn HHBH', () => {
      expect(check(receipt({ paymentContent: '4. HHBH' }))).toThrow(
        'không dùng cho phiếu thu',
      );
    });

    it('cấn trừ dùng cho cả hai loại', () => {
      expect(check(receipt({ paymentContent: '8. Cấn trừ' }))).not.toThrow();
      expect(
        check(payment({ paymentContent: '8. Cấn trừ', caseId: 'case-1' })),
      ).not.toThrow();
    });

    it('giữ nội dung sai loại đang lưu khi chỉ sửa ghi chú', () => {
      const old = payment({ paymentContent: '3. BH thanh toán', note: 'cũ' });
      expect(check({ ...old, note: 'mới' }, old)).not.toThrow();
    });

    it('bắt chọn lại khi đổi trạng thái một nội dung sai loại', () => {
      const old = payment({
        paymentStatus: 'PENDING',
        paymentContent: '3. BH thanh toán',
        caseId: 'case-1',
      });
      expect(check({ ...old, paymentStatus: 'PAID' }, old)).toThrow(
        'không dùng cho phiếu chi',
      );
    });

    it('giữ nhãn chi cũ khi đổi trạng thái, không cho chọn mới', () => {
      const old = payment({
        paymentStatus: 'PENDING',
        paymentContent: '6. HH Thưởng',
      });
      expect(check({ ...old, paymentStatus: 'PAID' }, old)).not.toThrow();
      expect(check(payment({ paymentContent: '6. HH Thưởng' }))).toThrow(
        BadRequestException,
      );
    });

    it('nội dung dự thu chỉ hợp lệ khi còn EXPECTED', () => {
      const expected = receipt({
        paymentStatus: 'EXPECTED',
        paymentContent: 'Dự thu hoàn tất phiếu dịch vụ',
      });
      expect(check({ ...expected, amount: 200000 }, expected)).not.toThrow();
      expect(check({ ...expected, paymentStatus: 'PAID' }, expected)).toThrow(
        BadRequestException,
      );
    });

    it('bù trạng thái cho phiếu thu cũ không tính là đổi trạng thái', () => {
      const old = receipt({
        paymentStatus: null,
        paymentContent: 'Dự thu hoàn tất phiếu dịch vụ',
      });
      expect(
        check({ ...old, paymentStatus: 'PAID', note: 'x' }, old),
      ).not.toThrow();
    });

    it('chặn phương thức lạ khi nhập mới, giữ giá trị cũ không đổi', () => {
      expect(check(receipt({ paymentMethod: 'Ví điện tử' }))).toThrow(
        'không hợp lệ',
      );
      const old = receipt({ paymentMethod: 'Quẹt thẻ' });
      expect(check({ ...old, note: 'x' }, old)).not.toThrow();
    });
  });

  describe('R4 nội dung cần phiếu dịch vụ', () => {
    it.each(['1. KH thanh toán', '3. BH thanh toán', '8. Cấn trừ'])(
      'chặn %s khi không có phiếu dịch vụ và không có lý do',
      (paymentContent) => {
        expect(
          check(receipt({ paymentContent, caseId: null, note: '  ' })),
        ).toThrow('cần gắn phiếu dịch vụ');
      },
    );

    it('cho qua khi ghi lý do', () => {
      expect(
        check(receipt({ caseId: null, note: 'Khách trả gộp' })),
      ).not.toThrow();
    });

    it('chặn khi bỏ liên kết phiếu dịch vụ mà không ghi lý do', () => {
      const old = receipt();
      expect(check({ ...old, caseId: null }, old)).toThrow(
        'cần gắn phiếu dịch vụ',
      );
    });

    it('không chặn phiếu cũ thiếu liên kết khi chỉ sửa số tiền', () => {
      const old = receipt({ caseId: null });
      expect(check({ ...old, amount: 200000 }, old)).not.toThrow();
    });

    it('nội dung khác không cần phiếu dịch vụ', () => {
      expect(
        check(receipt({ paymentContent: '2. Tất toán', caseId: null })),
      ).not.toThrow();
    });
  });
});
