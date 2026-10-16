import {
  MAX_DAILY_BUCKETS,
  bucketCashflow,
  mondayOf,
  type CashflowBucketInput,
} from './garage-period-cashflow-bucket.helper';

const v = (
  transDate: string,
  type: 'RECEIPT' | 'PAYMENT',
  amount: number,
): CashflowBucketInput => ({ transDate, type, amount });

describe('garage-period-cashflow-bucket.helper', () => {
  describe('mondayOf', () => {
    it('trả về thứ Hai của tuần chứa ngày, kể cả Chủ nhật và vắt qua tháng/năm', () => {
      expect(mondayOf('2026-10-14')).toBe('2026-10-12'); // thứ Tư
      expect(mondayOf('2026-10-12')).toBe('2026-10-12'); // chính thứ Hai
      expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // Chủ nhật
      expect(mondayOf('2026-11-01')).toBe('2026-10-26'); // Chủ nhật, lùi sang tháng trước
      expect(mondayOf('2026-01-01')).toBe('2025-12-29'); // lùi sang năm trước
    });
  });

  describe('bucketCashflow', () => {
    it('ít ngày: giữ theo ngày, cộng thu và chi cùng ngày, sắp tăng dần', () => {
      const result = bucketCashflow([
        v('2026-10-06', 'PAYMENT', 200),
        v('2026-10-05', 'RECEIPT', 700),
        v('2026-10-05', 'RECEIPT', 300),
        v('2026-10-05', 'PAYMENT', 50),
      ]);
      expect(result).toEqual([
        { label: '05/10', thu: 1000, chi: 50 },
        { label: '06/10', thu: 0, chi: 200 },
      ]);
    });

    it(`đúng ${MAX_DAILY_BUCKETS} ngày vẫn theo ngày, vượt thì gộp theo tuần`, () => {
      const dayList = (n: number) =>
        Array.from({ length: n }, (_, i) =>
          v(`2026-10-${String(i + 1).padStart(2, '0')}`, 'RECEIPT', 10),
        );

      expect(bucketCashflow(dayList(MAX_DAILY_BUCKETS))).toHaveLength(
        MAX_DAILY_BUCKETS,
      );

      // 15 ngày liên tiếp 01-15/10/2026: tuần 28/09, 05/10, 12/10
      const weekly = bucketCashflow(dayList(MAX_DAILY_BUCKETS + 1));
      expect(weekly.map((b) => b.label)).toEqual([
        'Tuần 28/09',
        'Tuần 05/10',
        'Tuần 12/10',
      ]);
      // 01-04/10 (4 ngày), 05-11/10 (7 ngày), 12-15/10 (4 ngày)
      expect(weekly.map((b) => b.thu)).toEqual([40, 70, 40]);
    });

    it('gộp tuần: tổng thu chi bảo toàn và không lẫn giữa các tuần', () => {
      const input: CashflowBucketInput[] = Array.from({ length: 20 }, (_, i) =>
        v(
          `2026-09-${String(i + 1).padStart(2, '0')}`,
          i % 2 ? 'PAYMENT' : 'RECEIPT',
          100 + i,
        ),
      );
      const result = bucketCashflow(input);
      const total = (type: 'RECEIPT' | 'PAYMENT') =>
        input.filter((x) => x.type === type).reduce((a, x) => a + x.amount, 0);
      expect(result.reduce((a, b) => a + b.thu, 0)).toBe(total('RECEIPT'));
      expect(result.reduce((a, b) => a + b.chi, 0)).toBe(total('PAYMENT'));
    });

    it('bỏ phiếu thiếu ngày; danh sách rỗng cho kết quả rỗng', () => {
      expect(bucketCashflow([])).toEqual([]);
      expect(bucketCashflow([v('', 'RECEIPT', 5)])).toEqual([]);
    });
  });
});
