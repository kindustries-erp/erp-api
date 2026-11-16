import { buildAnalyticsResponse } from './garage-debts-analytics.mapper';

describe('buildAnalyticsResponse', () => {
  it('tổng, tỷ lệ thu/chi và mốc đến hạn; dữ liệu rỗng cho 0', () => {
    const empty = buildAnalyticsResponse({}, {}, [], [], []);
    expect(empty.summary.collectionRate).toBe(0);
    expect(empty.cashTrend).toEqual([]);

    const res = buildAnalyticsResponse(
      {
        total: '1000',
        paid: '250',
        remaining: '750',
        aging_0_30: '750',
        due_week: '100',
      },
      {
        total: '400',
        paid: '100',
        remaining: '300',
        aging_31_60: '300',
        due_week: '0',
      },
      [{ month: '2026-10', cash_in: '250', cash_out: '100' }],
      [],
      [],
    );
    expect(res.summary).toMatchObject({
      netBalance: 450,
      collectionRate: 25,
      paymentRate: 25,
    });
    expect(res.timeHorizons.nextWeekDue).toEqual({
      receivable: 100,
      payable: 0,
      net: 100,
    });
    expect(res.timeHorizons.overdue30To90.payable).toBe(300);
    expect(res.cashTrend[0]).toEqual({
      label: '2026-10',
      cashIn: 250,
      cashOut: 100,
      netCash: 150,
    });
  });
});
