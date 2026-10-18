import {
  getOpexCategoryForContent,
  isDebtOffsetPayment,
  isPaymentLocked,
  isRecordedToOpex,
  isReceiptSettled,
  shouldHaveSettlement,
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

    it.each(['4. HHBH', '8. Vật tư tiêu hao', '10. Vật tư tiêu hao'])(
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
      'ghi opex khi 4/8/10 ở trạng thái %s',
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
          paymentContent: '10. Vật tư tiêu hao',
        }),
      ).toBe(false);
    });

    it('không ghi opex với nội dung khác 4/8/10', () => {
      expect(
        isRecordedToOpex({
          voucherType: 'PAYMENT',
          paymentStatus: 'PAID',
          paymentContent: '11. Chi phí vận hành',
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
      expect(getOpexCategoryForContent('4. HHBH')?.categoryKey).toBe('HHBH');
      expect(getOpexCategoryForContent('8. Vật tư tiêu hao')?.categoryKey).toBe(
        'VAT_TU_TIEU_HAO',
      );
      expect(
        getOpexCategoryForContent('10. Vật tư tiêu hao')?.categoryKey,
      ).toBe('VAT_TU_TIEU_HAO');
      expect(getOpexCategoryForContent('1. KH thanh toán')).toBeNull();
      expect(getOpexCategoryForContent(undefined)).toBeNull();
    });
  });

  describe('isReceiptSettled', () => {
    it('phiếu thu Đã thu hoặc null đều được tính settlement', () => {
      expect(
        isReceiptSettled({ voucherType: 'RECEIPT', paymentStatus: 'PAID' }),
      ).toBe(true);
      expect(
        isReceiptSettled({ voucherType: 'RECEIPT', paymentStatus: null }),
      ).toBe(true);
      expect(isReceiptSettled({ voucherType: 'RECEIPT' })).toBe(true);
    });

    it('phiếu thu Dự thu (EXPECTED) không được tính settlement', () => {
      expect(
        isReceiptSettled({ voucherType: 'RECEIPT', paymentStatus: 'EXPECTED' }),
      ).toBe(false);
    });
  });

  describe('shouldHaveSettlement', () => {
    it('phiếu thu thường có settlement, phiếu thu dự thu không có settlement', () => {
      expect(
        shouldHaveSettlement({ voucherType: 'RECEIPT', paymentStatus: 'PAID' }),
      ).toBe(true);
      expect(
        shouldHaveSettlement({ voucherType: 'RECEIPT', paymentStatus: null }),
      ).toBe(true);
      expect(
        shouldHaveSettlement({
          voucherType: 'RECEIPT',
          paymentStatus: 'EXPECTED',
        }),
      ).toBe(false);
    });

    it('phiếu chi Đã chi và không phải 4/8 mới có settlement', () => {
      expect(
        shouldHaveSettlement({
          voucherType: 'PAYMENT',
          paymentStatus: 'PAID',
          paymentContent: '7. Phụ tùng / vật tư',
        }),
      ).toBe(true);
      expect(
        shouldHaveSettlement({
          voucherType: 'PAYMENT',
          paymentStatus: 'PENDING',
          paymentContent: '7. Phụ tùng / vật tư',
        }),
      ).toBe(false);
      expect(
        shouldHaveSettlement({
          voucherType: 'PAYMENT',
          paymentStatus: 'PAID',
          paymentContent: '4. HHBH',
        }),
      ).toBe(false);
    });
  });
});
