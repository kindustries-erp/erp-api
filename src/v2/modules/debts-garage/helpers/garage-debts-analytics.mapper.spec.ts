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

  it('mốc 8–30 không chồng lấn ≤7; 31–60 và 61–90 tách riêng; overdue30To90 = tổng hai mốc', () => {
    const res = buildAnalyticsResponse(
      {
        aging_0_30: '500',
        due_week: '120',
        aging_31_60: '200',
        aging_61_90: '90',
        aging_over_90: '40',
      },
      {
        aging_0_30: '300',
        due_week: '50',
        aging_31_60: '70',
        aging_61_90: '30',
        aging_over_90: '10',
      },
      [],
      [],
      [],
    );
    const h = res.timeHorizons;
    expect(h.nextWeekDue.receivable).toBe(120);
    expect(h.nextMonthDue.receivable).toBe(380);
    expect(h.nextWeekDue.receivable + h.nextMonthDue.receivable).toBe(500);
    expect(h.nextMonthDue.payable).toBe(250);
    expect(h.overdue31To60).toEqual({
      receivable: 200,
      payable: 70,
      net: 130,
    });
    expect(h.overdue61To90).toEqual({
      receivable: 90,
      payable: 30,
      net: 60,
    });
    expect(h.overdue30To90.receivable).toBe(
      h.overdue31To60.receivable + h.overdue61To90.receivable,
    );
    expect(h.overdue30To90.payable).toBe(
      h.overdue31To60.payable + h.overdue61To90.payable,
    );
    expect(h.criticalOverdue90Plus.receivable).toBe(40);
  });
});
