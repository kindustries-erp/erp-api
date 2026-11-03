import { splitBalancedLinesByBranch, splitEvenly } from './money-split.util';

describe('splitBalancedLinesByBranch', () => {
  const sumBy = (
    lines: { accountId: string; debit: number; credit: number }[],
    key: 'debit' | 'credit',
    accountId?: string,
  ) =>
    lines
      .filter((l) => !accountId || l.accountId === accountId)
      .reduce((s, l) => s + l[key], 0);

  it('mỗi chi nhánh nhận một bộ dòng cân Nợ = Có và tổng từng tài khoản được giữ nguyên', () => {
    const lines = [
      { accountId: '1121', debit: 100.01, credit: 0 },
      { accountId: '331', debit: 0, credit: 60.01 },
      { accountId: '1561', debit: 0, credit: 40 },
    ];

    const buckets = splitBalancedLinesByBranch(lines, 3);

    for (const bucket of buckets) {
      expect(sumBy(bucket, 'debit')).toBeCloseTo(sumBy(bucket, 'credit'), 2);
    }
    const all = buckets.flat();
    expect(sumBy(all, 'debit', '1121')).toBeCloseTo(100.01, 2);
    expect(sumBy(all, 'credit', '331')).toBeCloseTo(60.01, 2);
    expect(sumBy(all, 'credit', '1561')).toBeCloseTo(40, 2);
  });

  it('n = 1 trả về đúng các cặp của bút toán gốc', () => {
    const buckets = splitBalancedLinesByBranch(
      [
        { accountId: '1121', debit: 500, credit: 0 },
        { accountId: '131', debit: 0, credit: 500 },
      ],
      1,
    );
    expect(buckets).toHaveLength(1);
    expect(sumBy(buckets[0], 'debit')).toBe(500);
    expect(sumBy(buckets[0], 'credit')).toBe(500);
  });
});

describe('splitEvenly', () => {
  it('chia đều khi chia hết', () => {
    expect(splitEvenly(300000, 3)).toEqual([100000, 100000, 100000]);
  });

  it('dồn phần dư 1 đồng cho các phần đầu và tổng khớp', () => {
    const parts = splitEvenly(100, 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('xử lý số âm (bút toán đảo chiều) và tổng vẫn khớp', () => {
    const parts = splitEvenly(-100, 3);
    expect(parts).toEqual([-34, -33, -33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-100);
  });

  it('n = 1 trả về nguyên giá trị', () => {
    expect(splitEvenly(1234567, 1)).toEqual([1234567]);
  });

  it('n <= 0 trả về mảng rỗng', () => {
    expect(splitEvenly(100, 0)).toEqual([]);
  });

  it('total = 0 trả về toàn 0', () => {
    expect(splitEvenly(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('làm tròn total về đồng nguyên trước khi chia', () => {
    const parts = splitEvenly(10.4, 2);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('chia theo xu khi decimals = 2 và tổng khớp', () => {
    const parts = splitEvenly(100.01, 3, 2);
    expect(parts).toEqual([33.34, 33.34, 33.33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100.01, 2);
  });
});
