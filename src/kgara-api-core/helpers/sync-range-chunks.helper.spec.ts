import {
  recentMonthsRange,
  splitMonthlyRanges,
} from './sync-range-chunks.helper';

describe('splitMonthlyRanges', () => {
  it('6 tháng từ 2026-05-25 đến 2026-11-25: 7 đoạn, mới trước, cắt hai đầu', () => {
    expect(splitMonthlyRanges('2026-05-25', '2026-11-25')).toEqual([
      { from: '2026-11-01', to: '2026-11-25' },
      { from: '2026-10-01', to: '2026-10-31' },
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-08-01', to: '2026-08-31' },
      { from: '2026-07-01', to: '2026-07-31' },
      { from: '2026-06-01', to: '2026-06-30' },
      { from: '2026-05-25', to: '2026-05-31' },
    ]);
  });

  it('các đoạn liên tiếp, không chồng, không hở (qua năm, tháng 2 nhuận)', () => {
    const ranges = splitMonthlyRanges('2027-12-15', '2028-03-02').reverse();
    expect(ranges[0].from).toBe('2027-12-15');
    expect(ranges.at(-1)?.to).toBe('2028-03-02');
    expect(ranges.map((r) => r.from)).toEqual([
      '2027-12-15',
      '2028-01-01',
      '2028-02-01',
      '2028-03-01',
    ]);
    expect(ranges[2].to).toBe('2028-02-29');
    for (let i = 1; i < ranges.length; i++) {
      const prevEnd = new Date(`${ranges[i - 1].to}T00:00:00Z`);
      const nextStart = new Date(`${ranges[i].from}T00:00:00Z`);
      expect(nextStart.getTime() - prevEnd.getTime()).toBe(86_400_000);
    }
  });

  it('cùng một tháng → một đoạn; nhận cả chuỗi có giờ', () => {
    expect(splitMonthlyRanges('2026-10-03', '2026-10-20T23:59:59')).toEqual([
      { from: '2026-10-03', to: '2026-10-20' },
    ]);
  });

  it('from > to hoặc ngày sai → mảng rỗng', () => {
    expect(splitMonthlyRanges('2026-11-02', '2026-11-01')).toEqual([]);
    expect(splitMonthlyRanges('abc', '2026-11-01')).toEqual([]);
  });
});

describe('recentMonthsRange', () => {
  it('đúng ngày này 6 tháng trước đến hôm nay', () => {
    expect(recentMonthsRange('2026-11-25', 6)).toEqual({
      from: '2026-05-25',
      to: '2026-11-25',
    });
  });

  it('qua năm và ngày cuối tháng được kẹp', () => {
    expect(recentMonthsRange('2027-03-05', 6)?.from).toBe('2026-09-05');
    expect(recentMonthsRange('2026-08-31', 6)?.from).toBe('2026-02-28');
  });

  it('ngày sai → null', () => {
    expect(recentMonthsRange('x', 6)).toBeNull();
  });
});
