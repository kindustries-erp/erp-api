import {
  getOpexCategoryForContent,
  isDebtOffsetPayment,
  isPaymentLocked,
  isRecordedToOpex,
} from './garage-cashflow-payment-rules';

describe('garage-cashflow-payment-rules', () => {
  describe('isDebtOffsetPayment', () => {
    it('chỉ phiếu chi Đã chi nội dung thường mới trừ công nợ', () => {
      expect(
        isDebtOffsetPayment({
          voucherType: 'PAYMENT',
          paymentStatus: 'PAID',
          paymentContent: '7. Phụ tùng / vật tư',
        }),
      ).toBe(true);
    });

    it.each(['PENDING', 'APPROVED', null])(
      'không trừ công nợ khi trạng thái là %s',
      (status) => {
        expect(
          isDebtOffsetPayment({
            voucherType: 'PAYMENT',
            paymentStatus: status,
            paymentContent: '7. Phụ tùng / vật tư',
          }),
        ).toBe(false);
      },
    );

    it.each(['4. HHBH', '8. Vật tư tiêu hao'])(
      'không trừ công nợ với nội dung %s dù Đã chi',
      (content) => {
        expect(
          isDebtOffsetPayment({
            voucherType: 'PAYMENT',
            paymentStatus: 'PAID',
            paymentContent: content,
          }),
        ).toBe(false);
      },
    );

    it('phiếu thu không phải khoản trừ công nợ phải trả', () => {
      expect(
        isDebtOffsetPayment({ voucherType: 'RECEIPT', paymentStatus: null }),
      ).toBe(false);
    });
  });

  describe('isRecordedToOpex', () => {
    it.each(['APPROVED', 'PAID'])(
      'ghi opex khi 4/8 ở trạng thái %s',
      (status) => {
        expect(
          isRecordedToOpex({
            voucherType: 'PAYMENT',
            paymentStatus: status,
            paymentContent: '4. HHBH',
          }),
        ).toBe(true);
      },
    );

    it('không ghi opex khi Chờ duyệt', () => {
      expect(
        isRecordedToOpex({
          voucherType: 'PAYMENT',
          paymentStatus: 'PENDING',
          paymentContent: '8. Vật tư tiêu hao',
        }),
      ).toBe(false);
    });

    it('không ghi opex với nội dung khác 4/8', () => {
      expect(
        isRecordedToOpex({
          voucherType: 'PAYMENT',
          paymentStatus: 'PAID',
          paymentContent: '9. Chi phí vận hành',
        }),
      ).toBe(false);
    });
  });

  describe('isPaymentLocked', () => {
    it('khóa khi phiếu chi Đã chi', () => {
      expect(
        isPaymentLocked({ voucherType: 'PAYMENT', paymentStatus: 'PAID' }),
      ).toBe(true);
      expect(
        isPaymentLocked({ voucherType: 'PAYMENT', paymentStatus: 'APPROVED' }),
      ).toBe(false);
    });
  });

  describe('getOpexCategoryForContent', () => {
    it('map nội dung sang nhóm Giá vốn', () => {
      expect(getOpexCategoryForContent('4. HHBH')?.categoryKey).toBe(
        'HOA_HONG_TRUC_TIEP',
      );
      expect(getOpexCategoryForContent('8. Vật tư tiêu hao')?.categoryKey).toBe(
        'CHI_PHI_TRUC_TIEP_KHAC',
      );
      expect(getOpexCategoryForContent('1. KH thanh toán')).toBeNull();
      expect(getOpexCategoryForContent(undefined)).toBeNull();
    });
  });
});
