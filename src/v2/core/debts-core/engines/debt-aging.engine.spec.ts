import { DEFAULT_AGING_BUCKETS, DebtAgingEngine } from './debt-aging.engine';

const AS_OF = new Date(2026, 10, 16, 12, 0, 0); // 2026-11-16 giờ máy chủ

describe('DebtAgingEngine.daysOutstanding', () => {
  it('đếm ngày lịch giữa ngày mốc và asOf', () => {
    expect(DebtAgingEngine.daysOutstanding('2026-11-16', AS_OF)).toBe(0);
    expect(DebtAgingEngine.daysOutstanding('2026-11-15', AS_OF)).toBe(1);
    expect(DebtAgingEngine.daysOutstanding('2026-10-17', AS_OF)).toBe(30);
  });

  it('bỏ phần giờ của chuỗi ISO, không lệch múi giờ', () => {
    expect(
      DebtAgingEngine.daysOutstanding('2026-11-15T23:59:59.999+07:00', AS_OF),
    ).toBe(1);
    expect(DebtAgingEngine.daysOutstanding('2026-11-15 00:00:00', AS_OF)).toBe(
      1,
    );
  });

  it('nhận Date', () => {
    expect(DebtAgingEngine.daysOutstanding(new Date(2026, 10, 1), AS_OF)).toBe(
      15,
    );
  });

  it('Date tính theo ngày lịch của máy chủ, như CURRENT_DATE - DATE(cột) của SQL', () => {
    // Cột timestamp 2026-08-18 00:00 (giờ máy chủ) và "bây giờ" là 03:00 sáng 2026-09-17.
    const base = new Date(2026, 7, 18, 0, 0, 0);
    const asOf = new Date(2026, 8, 17, 3, 0, 0);
    expect(DebtAgingEngine.daysOutstanding(base, asOf)).toBe(30);
    expect(
      DebtAgingEngine.bucketOf(DebtAgingEngine.daysOutstanding(base, asOf)!),
    ).toBe('0-30');
    // Sát nửa đêm vẫn đếm theo ngày lịch, không theo số giờ.
    expect(
      DebtAgingEngine.daysOutstanding(
        new Date(2026, 8, 16, 23, 59, 0),
        new Date(2026, 8, 17, 0, 1, 0),
      ),
    ).toBe(1);
  });

  it('ngày ở tương lai cho số âm', () => {
    expect(DebtAgingEngine.daysOutstanding('2026-11-20', AS_OF)).toBe(-4);
  });

  it('thiếu hoặc sai ngày trả null', () => {
    expect(DebtAgingEngine.daysOutstanding(null, AS_OF)).toBeNull();
    expect(DebtAgingEngine.daysOutstanding(undefined, AS_OF)).toBeNull();
    expect(
      DebtAgingEngine.daysOutstanding('không phải ngày', AS_OF),
    ).toBeNull();
  });
});

describe('DebtAgingEngine.bucketOf', () => {
  it.each([
    [-5, '0-30'],
    [0, '0-30'],
    [30, '0-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '61-90'],
    [90, '61-90'],
    [91, '>90'],
    [1000, '>90'],
  ])('%i ngày rơi vào mốc %s', (days, key) => {
    expect(DebtAgingEngine.bucketOf(days)).toBe(key);
  });

  it('báo lỗi khi thiếu mốc cuối không giới hạn', () => {
    expect(() =>
      DebtAgingEngine.bucketOf(500, [{ key: 'x', maxDays: 30 }]),
    ).toThrow(/mốc cuối/);
  });
});

describe('DebtAgingEngine.distribute', () => {
  it('chia số dư vào mốc, tổng các mốc cộng undated bằng tổng số dư', () => {
    const rows = [
      { baseDate: '2026-11-10', balance: 100 }, // 6 ngày
      { baseDate: '2026-10-10', balance: '200.50' }, // 37 ngày
      { baseDate: '2026-09-01', balance: 300 }, // 76 ngày
      { baseDate: '2026-06-01', balance: 400 }, // >90
      { baseDate: null, balance: 50 },
    ];

    const result = DebtAgingEngine.distribute(rows, AS_OF);

    expect(result.buckets).toEqual({
      '0-30': 100,
      '31-60': 200.5,
      '61-90': 300,
      '>90': 400,
    });
    expect(result.undated).toBe(50);
    const total =
      Object.values(result.buckets).reduce((a, b) => a + b, 0) + result.undated;
    expect(total).toBe(1050.5);
  });

  it('luôn có đủ khóa mốc kể cả khi không có dòng nào', () => {
    const result = DebtAgingEngine.distribute([], AS_OF);
    expect(Object.keys(result.buckets)).toEqual(
      DEFAULT_AGING_BUCKETS.map((b) => b.key),
    );
    expect(result.undated).toBe(0);
  });
});

describe('DebtAgingEngine.oldestDays', () => {
  it('chỉ xét khoản còn nợ', () => {
    const rows = [
      { baseDate: '2026-01-01', balance: 0 },
      { baseDate: '2026-10-01', balance: 10 },
      { baseDate: '2026-11-10', balance: 5 },
    ];
    expect(DebtAgingEngine.oldestDays(rows, AS_OF)).toBe(46);
  });

  it('không khoản nào còn nợ thì null', () => {
    expect(
      DebtAgingEngine.oldestDays(
        [{ baseDate: '2026-01-01', balance: 0 }],
        AS_OF,
      ),
    ).toBeNull();
  });
});
