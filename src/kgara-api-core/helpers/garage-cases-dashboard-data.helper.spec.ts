import {
  bucketOf,
  buildCashSeries,
  buildTimeSeries,
  chooseBucketUnit,
  classificationBreakdown,
  isoWeekParts,
  pickBasisDate,
  spanInDays,
  topCustomersByRevenue,
} from './garage-cases-dashboard-data.helper';
import type { CaseDashboardRow } from './kgara-completed-cases-sheet.builder';

const row = (over: Partial<CaseDashboardRow> = {}): CaseDashboardRow => ({
  caseNo: 'PDV-1',
  customerName: 'Khách A',
  classification: 'Sửa chữa chung',
  receivedDate: null,
  completionDate: new Date(2026, 6, 10),
  issuedDate: null,
  revenue: 100,
  cost: 60,
  profit: 40,
  receivable: 0,
  payable: 0,
  received: 0,
  paid: 0,
  expected: 0,
  planned: 0,
  ...over,
});

describe('chooseBucketUnit', () => {
  it.each([
    [1, 'day'],
    [31, 'day'],
    [32, 'week'],
    [120, 'week'],
    [121, 'month'],
    [365, 'month'],
  ])('%i ngày → %s', (days, unit) => {
    expect(chooseBucketUnit(days as number)).toBe(unit);
  });
});

describe('spanInDays', () => {
  it('tính theo from/to (bao gồm cả hai đầu)', () => {
    expect(spanInDays('2026-07-01', '2026-07-31', [])).toBe(31);
    expect(spanInDays('2026-07-01', '2026-07-01', [])).toBe(1);
    expect(
      spanInDays('2026-07-01T00:00:00', '2026-09-30T23:59:59', []),
    ).toBeGreaterThan(90);
  });

  it('thiếu from/to thì lấy theo dữ liệu', () => {
    const dates = [new Date(2026, 0, 1), new Date(2026, 0, 10)];
    expect(spanInDays(undefined, undefined, dates)).toBe(10);
    expect(spanInDays('2026-01-05', undefined, dates)).toBe(6);
    expect(spanInDays(undefined, undefined, [])).toBe(0);
  });
});

describe('isoWeekParts', () => {
  it.each([
    [new Date(2026, 0, 1), 2026, 1], // thứ Năm → tuần 1
    [new Date(2025, 11, 29), 2026, 1], // thứ Hai vắt sang năm ISO 2026
    [new Date(2027, 0, 1), 2026, 53], // thứ Sáu thuộc tuần 53 của 2026
    [new Date(2026, 11, 31), 2026, 53],
    [new Date(2026, 9, 12), 2026, 42],
  ])('%s → %i-W%i', (date, year, week) => {
    expect(isoWeekParts(date as Date)).toEqual({ year, week });
  });
});

describe('bucketOf', () => {
  const d = new Date(2026, 6, 5);
  it('nhãn và khóa theo ngày/tuần/tháng', () => {
    expect(bucketOf(d, 'day')).toEqual({ key: '2026-07-05', label: '05/07' });
    expect(bucketOf(d, 'week')).toEqual({
      key: '2026-W27',
      label: 'Tuần 27/2026',
    });
    expect(bucketOf(d, 'month')).toEqual({ key: '2026-07', label: '07/2026' });
  });
});

describe('pickBasisDate', () => {
  const r = row({
    receivedDate: new Date(2026, 5, 1),
    completionDate: new Date(2026, 6, 10),
    issuedDate: new Date(2026, 4, 1),
  });
  it('chọn ngày theo cơ sở và có fallback', () => {
    expect(pickBasisDate(r, 'completion')).toEqual(new Date(2026, 6, 10));
    expect(pickBasisDate(r, 'received')).toEqual(new Date(2026, 5, 1));
    expect(pickBasisDate(r, 'issued')).toEqual(new Date(2026, 4, 1));
    expect(
      pickBasisDate(
        row({
          completionDate: null,
          receivedDate: null,
          issuedDate: new Date(2026, 1, 1),
        }),
        'completion',
      ),
    ).toEqual(new Date(2026, 1, 1));
    expect(
      pickBasisDate(
        row({ completionDate: null, receivedDate: null, issuedDate: null }),
        'completion',
      ),
    ).toBeNull();
  });
});

describe('buildTimeSeries', () => {
  it('gộp theo kỳ, sắp tăng dần, bỏ phiếu không có ngày', () => {
    const rows = [
      row({
        completionDate: new Date(2026, 6, 12),
        revenue: 200,
        cost: 100,
        profit: 100,
      }),
      row({
        completionDate: new Date(2026, 6, 10),
        revenue: 100,
        cost: 60,
        profit: 40,
      }),
      row({
        completionDate: new Date(2026, 6, 11),
        revenue: 50,
        cost: 10,
        profit: 40,
      }),
      row({
        completionDate: null,
        issuedDate: null,
        receivedDate: null,
        revenue: 999,
      }),
    ];

    const days = buildTimeSeries(rows, 'completion', 'day');
    expect(days.map((p) => p.label)).toEqual(['10/07', '11/07', '12/07']);

    const months = buildTimeSeries(rows, 'completion', 'month');
    expect(months).toEqual([
      {
        key: '2026-07',
        label: '07/2026',
        revenue: 350,
        cost: 170,
        profit: 180,
      },
    ]);
  });

  it('tuần ISO vắt năm gộp đúng một kỳ', () => {
    const rows = [
      row({
        completionDate: new Date(2025, 11, 29),
        revenue: 10,
        cost: 0,
        profit: 10,
      }),
      row({
        completionDate: new Date(2026, 0, 2),
        revenue: 5,
        cost: 0,
        profit: 5,
      }),
    ];
    const weeks = buildTimeSeries(rows, 'completion', 'week');
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ label: 'Tuần 01/2026', revenue: 15 });
  });
});

describe('classificationBreakdown & topCustomersByRevenue', () => {
  const rows = [
    row({ classification: 'OJ', customerName: 'A', revenue: 100, profit: 10 }),
    row({
      classification: 'Khác',
      customerName: 'B',
      revenue: 300,
      profit: 30,
    }),
    row({ classification: 'OJ', customerName: 'A', revenue: 50, profit: 5 }),
    row({ classification: 'Ký gửi', customerName: 'C', revenue: 0, profit: 0 }),
  ];

  it('phân loại: gộp, giảm dần, bỏ doanh thu 0', () => {
    expect(classificationBreakdown(rows)).toEqual([
      { label: 'Khác', revenue: 300, profit: 30 },
      { label: 'OJ', revenue: 150, profit: 15 },
    ]);
  });

  it('top khách hàng: gộp theo tên, giảm dần, giới hạn N', () => {
    expect(topCustomersByRevenue(rows)).toEqual([
      { label: 'B', revenue: 300, profit: 30 },
      { label: 'A', revenue: 150, profit: 15 },
    ]);
    expect(topCustomersByRevenue(rows, 1)).toHaveLength(1);
  });
});

describe('buildCashSeries', () => {
  it('gom đã thu, dự thu, đã trả, dự chi theo kỳ và bỏ kỳ không có phiếu', () => {
    const points = buildCashSeries(
      [
        row({
          completionDate: new Date(2026, 6, 10),
          received: 100,
          expected: 40,
          paid: 30,
          planned: 10,
        }),
        row({
          completionDate: new Date(2026, 6, 10),
          received: 50,
          expected: 0,
          paid: 0,
          planned: 5,
        }),
        row({
          completionDate: new Date(2026, 6, 12),
          received: 0,
          expected: 80,
          paid: 20,
          planned: 0,
        }),
      ],
      'completion',
      'day',
    );
    expect(points).toEqual([
      expect.objectContaining({
        received: 150,
        expected: 40,
        paid: 30,
        planned: 15,
      }),
      expect.objectContaining({
        received: 0,
        expected: 80,
        paid: 20,
        planned: 0,
      }),
    ]);
    expect(points).toHaveLength(2);
  });
});
