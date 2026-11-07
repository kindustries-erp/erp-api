import { toLegacyPaymentStatus } from './legacy-voucher.mapper';
import {
  buildLegacyVoucherCode,
  directionOf,
  needsPayment,
  toForecastStatus,
  toPaymentChannel,
  voucherTypeOf,
} from './legacy-voucher-write.mapper';

describe('legacy-voucher-write.mapper', () => {
  describe('directionOf / voucherTypeOf', () => {
    it('đổi qua lại đúng giữa thu/chi và IN/OUT', () => {
      expect(directionOf('RECEIPT')).toBe('IN');
      expect(directionOf('PAYMENT')).toBe('OUT');
      expect(voucherTypeOf('IN')).toBe('RECEIPT');
      expect(voucherTypeOf('OUT')).toBe('PAYMENT');
    });
  });

  describe('toForecastStatus', () => {
    it.each([
      ['IN', 'PAID', 'SETTLED'],
      ['IN', 'EXPECTED', 'OPEN'],
      ['IN', 'CANCELLED', 'CANCELLED'],
      ['OUT', 'PAID', 'SETTLED'],
      ['OUT', 'APPROVED', 'OPEN'],
      ['OUT', 'PENDING', 'DRAFT'],
      ['OUT', 'CANCELLED', 'CANCELLED'],
    ] as const)('%s %s -> %s', (direction, legacy, expected) => {
      expect(toForecastStatus(direction, legacy)).toBe(expected);
    });

    it('khớp vòng đi-về với toLegacyPaymentStatus (trừ IN PENDING/APPROVED không dùng)', () => {
      const legacyValues = [
        'PENDING',
        'APPROVED',
        'PAID',
        'CANCELLED',
      ] as const;
      for (const legacy of legacyValues) {
        const status = toForecastStatus('OUT', legacy);
        expect(toLegacyPaymentStatus('OUT', status)).toBe(legacy);
      }
      expect(
        toLegacyPaymentStatus('IN', toForecastStatus('IN', 'EXPECTED')),
      ).toBe('EXPECTED');
      expect(toLegacyPaymentStatus('IN', toForecastStatus('IN', 'PAID'))).toBe(
        'PAID',
      );
    });
  });

  describe('toPaymentChannel', () => {
    it.each([
      ['Tiền mặt', 'CASH'],
      ['Chuyển khoản', 'BANK'],
      ['Quẹt thẻ', 'POS'],
      ['Thẻ', 'POS'],
      ['Khác', 'OTHER'],
      [null, 'OTHER'],
      [undefined, 'OTHER'],
    ] as const)('%s -> %s', (method, expected) => {
      expect(toPaymentChannel(method)).toBe(expected);
    });
  });

  describe('buildLegacyVoucherCode', () => {
    const now = new Date('2026-11-07T10:00:00Z');

    it('thu dùng PT-GARA, chi dùng PC-GARA, ngày yymmdd và số thứ tự 3 chữ số', () => {
      expect(buildLegacyVoucherCode('RECEIPT', now, () => 0.0042)).toBe(
        'PT-GARA-261107-004',
      );
      expect(buildLegacyVoucherCode('PAYMENT', now, () => 0.999)).toBe(
        'PC-GARA-261107-999',
      );
    });
  });

  describe('needsPayment', () => {
    it('chỉ PAID cần thực thu/chi', () => {
      expect(needsPayment('PAID')).toBe(true);
      expect(needsPayment('EXPECTED')).toBe(false);
      expect(needsPayment('APPROVED')).toBe(false);
      expect(needsPayment('PENDING')).toBe(false);
      expect(needsPayment('CANCELLED')).toBe(false);
    });
  });
});
