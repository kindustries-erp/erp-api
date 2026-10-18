import {
  groupPnlPeriods,
  pnlPeriodLabel,
  resolvePnlPeriod,
} from './garage-pnl-period.helper';
import type { PnlMonthRow } from './garage-pnl-month.helper';

const TODAY = new Date(2026, 9, 18);

const month = (
  year: number,
  m: number,
  patch: Partial<PnlMonthRow> = {},
): PnlMonthRow => ({
  year,
  month: m,
  revenue: 100,
  cogs: 60,
  cogsDirect: 60,
  cogsAdjustmentItems: [],
  revenueSegments: [],
  grossProfit: 40,
  grossMarginRate: 40,
  opexTotal: 10,
  opexItems: [{ categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 10 }],
  netBeforeCommission: 30,
  hhbhTotal: 0,
  commissionTotal: 0,
  commissionItems: [
    { categoryKey: 'RATE_LAI_GOP_KY_GUI', categoryName: 'Tỷ lệ', amount: 10 },
  ],
  netAfterCommission: 30,
  ...patch,
});

describe('garage-pnl-period.helper', () => {
  it('kỳ trong một tháng → tháng của to; kỳ quý trọn → 3 tháng; kỳ lẻ nhiều tháng', () => {
    expect(resolvePnlPeriod('2026-10-01', '2026-10-31', TODAY)).toEqual({
      size: 1,
      end: { year: 2026, month: 10 },
    });
    expect(resolvePnlPeriod('2026-07-01', '2026-09-30', TODAY)).toEqual({
      size: 3,
      end: { year: 2026, month: 9 },
    });
    expect(resolvePnlPeriod('2026-08-01', '2026-10-31', TODAY)).toEqual({
      size: 3,
      end: { year: 2026, month: 10 },
    });
  });

  it('thiếu from/to hoặc quá 12 tháng → tháng báo cáo như cũ', () => {
    expect(resolvePnlPeriod(undefined, '2026-10-31', TODAY)).toEqual({
      size: 1,
      end: { year: 2026, month: 10 },
    });
    expect(resolvePnlPeriod('2025-01-01', '2026-10-31', TODAY).size).toBe(1);
  });

  it('nhãn kỳ: tháng, quý, kỳ cùng năm, kỳ qua năm', () => {
    expect(pnlPeriodLabel(1, { year: 2026, month: 10 })).toBe('Tháng 10/2026');
    expect(pnlPeriodLabel(3, { year: 2026, month: 9 })).toBe('Quý 3/2026');
    expect(pnlPeriodLabel(3, { year: 2026, month: 10 })).toBe('Kỳ 08–10/2026');
    expect(pnlPeriodLabel(3, { year: 2026, month: 2 })).toBe(
      'Kỳ 12/2025–02/2026',
    );
  });

  it('gom quý: cộng số tiền, tỷ lệ lãi gộp ký gửi bình quân theo lợi nhuận gộp', () => {
    const months = [
      month(2026, 7, {
        grossProfit: 30,
        commissionItems: [
          {
            categoryKey: 'RATE_LAI_GOP_KY_GUI',
            categoryName: 'Tỷ lệ',
            amount: 10,
          },
        ],
      }),
      month(2026, 8, {
        grossProfit: 10,
        commissionItems: [
          {
            categoryKey: 'RATE_LAI_GOP_KY_GUI',
            categoryName: 'Tỷ lệ',
            amount: 30,
          },
        ],
      }),
      month(2026, 9, { grossProfit: 0 }),
    ];
    const [quarter] = groupPnlPeriods(months, 3);
    expect(quarter.revenue).toBe(300);
    expect(quarter.grossProfit).toBe(40);
    expect(quarter.opexItems).toEqual([
      { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 30 },
    ]);
    expect(quarter.periodMonths).toBe(3);
    expect(quarter.periodStart).toEqual({ year: 2026, month: 7 });
    // (10·30 + 30·10) / (30 + 10) = 15
    expect(quarter.commissionItems[0].amount).toBeCloseTo(15, 6);
    expect(quarter.grossMarginRate).toBeCloseTo((40 / 300) * 100, 6);
  });

  it('size 1 giữ nguyên danh sách tháng', () => {
    const months = [month(2026, 9), month(2026, 10)];
    expect(groupPnlPeriods(months, 1)).toBe(months);
  });
});
