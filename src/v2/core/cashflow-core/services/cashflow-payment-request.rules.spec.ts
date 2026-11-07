import {
  allocatePaymentToLines,
  paymentRequestStatusAfter,
  remainingCapacityCents,
  sourcePaymentStatus,
  toCents,
} from './cashflow-payment-request.rules';

describe('cashflow-payment-request.rules', () => {
  describe('allocatePaymentToLines', () => {
    const lines = [
      { id: 'a', amountCents: 10000, paidCents: 0 },
      { id: 'b', amountCents: 5000, paidCents: 2000 },
    ];

    it('chia theo thứ tự dòng, không vượt phần còn lại của từng dòng', () => {
      expect(allocatePaymentToLines(lines, 12000)).toEqual([
        { lineId: 'a', amountCents: 10000 },
        { lineId: 'b', amountCents: 2000 },
      ]);
    });

    it('chi đủ tổng còn lại', () => {
      const out = allocatePaymentToLines(lines, 13000);
      expect(out.reduce((s, x) => s + x.amountCents, 0)).toBe(13000);
    });

    it('vượt phần còn lại thì ném lỗi', () => {
      expect(() => allocatePaymentToLines(lines, 13001)).toThrow(/vượt/);
    });

    it('số tiền không dương thì ném lỗi', () => {
      expect(() => allocatePaymentToLines(lines, 0)).toThrow();
      expect(() => allocatePaymentToLines(lines, -1)).toThrow();
    });

    it('bỏ qua dòng đã chi đủ', () => {
      const out = allocatePaymentToLines(
        [
          { id: 'x', amountCents: 100, paidCents: 100 },
          { id: 'y', amountCents: 100, paidCents: 0 },
        ],
        50,
      );
      expect(out).toEqual([{ lineId: 'y', amountCents: 50 }]);
    });
  });

  describe('paymentRequestStatusAfter', () => {
    it('chưa chi thì APPROVED, chi một phần thì PARTIAL, chi đủ thì PAID', () => {
      expect(paymentRequestStatusAfter(1000, 0, 'APPROVED')).toBe('APPROVED');
      expect(paymentRequestStatusAfter(1000, 400, 'APPROVED')).toBe('PARTIAL');
      expect(paymentRequestStatusAfter(1000, 1000, 'PARTIAL')).toBe('PAID');
    });

    it('void về 0 thì quay lại APPROVED', () => {
      expect(paymentRequestStatusAfter(1000, 0, 'PARTIAL')).toBe('APPROVED');
    });

    it('DNTT chưa duyệt hoặc đã hủy thì giữ nguyên trạng thái', () => {
      expect(paymentRequestStatusAfter(1000, 500, 'DRAFT')).toBe('DRAFT');
      expect(paymentRequestStatusAfter(1000, 0, 'CANCELLED')).toBe('CANCELLED');
    });
  });

  describe('sourcePaymentStatus', () => {
    it('UNPAID / PARTIAL / PAID theo tổng đã chi so với trần', () => {
      expect(sourcePaymentStatus(10000, 0)).toBe('UNPAID');
      expect(sourcePaymentStatus(10000, 3000)).toBe('PARTIAL');
      expect(sourcePaymentStatus(10000, 10000)).toBe('PAID');
    });
  });

  describe('remainingCapacityCents', () => {
    it('trừ các dòng đang hiệu lực, không âm', () => {
      expect(remainingCapacityCents(10000, 4000)).toBe(6000);
      expect(remainingCapacityCents(10000, 12000)).toBe(0);
    });
  });

  it('toCents làm tròn tiền thập phân không bị sai số', () => {
    expect(toCents('0.1') + toCents('0.2')).toBe(30);
    expect(toCents('1234567.89')).toBe(123456789);
  });
});
