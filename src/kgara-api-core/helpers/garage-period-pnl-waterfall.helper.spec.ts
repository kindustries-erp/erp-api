import {
  buildWaterfallSeries,
  buildWaterfallSteps,
} from './garage-period-pnl-waterfall.helper';
import type { PnlMonthRow } from './garage-pnl-month.helper';

const month = (patch: Partial<PnlMonthRow> = {}): PnlMonthRow => ({
  year: 2026,
  month: 10,
  revenue: 1000,
  cogs: 600,
  cogsDirect: 600,
  cogsAdjustmentItems: [],
  revenueSegments: [],
  grossProfit: 400,
  grossMarginRate: 40,
  opexTotal: 150,
  opexItems: [],
  netBeforeCommission: 250,
  hhbhTotal: 0,
  commissionTotal: 0,
  commissionItems: [],
  netAfterCommission: 250,
  ...patch,
});

describe('garage-period-pnl-waterfall.helper', () => {
  it('tháng lãi: tổng từ 0, giảm trôi đúng đáy, nhãn có tiền và %', () => {
    const steps = buildWaterfallSteps(month());
    const s = buildWaterfallSeries(steps, 1000);
    expect(s.categories[0]).toBe('Doanh thu · 1k · 100,0%');
    // Doanh thu: cột 0→1000
    expect(s.totalPos[0]).toBe(1000);
    // Giá vốn: trôi 400→1000, đáy 400, phần giảm 600
    expect(s.base[1]).toBe(400);
    expect(s.costPos[1]).toBe(600);
    // Lợi nhuận gộp: 0→400
    expect(s.totalPos[2]).toBe(400);
    // Lợi nhuận ròng: 0→250 (400 − 0 − 150)
    expect(s.totalPos[5]).toBe(250);
    expect(s.costNeg.every((v) => v === 0)).toBe(true);
  });

  it('tháng lỗ vắt qua 0: cột giảm được tách phần dương và phần âm', () => {
    // GP 100, opex 300 → số dư đi từ 100 xuống −200, vắt qua 0
    const steps = buildWaterfallSteps(
      month({
        revenue: 1000,
        cogs: 900,
        grossProfit: 100,
        opexTotal: 300,
        netBeforeCommission: -200,
        netAfterCommission: -200,
      }),
    );
    const s = buildWaterfallSeries(steps, 1000);
    const opex = 4;
    expect(s.base[opex]).toBe(0);
    expect(s.costPos[opex]).toBe(100);
    expect(s.costNeg[opex]).toBe(-200);
    // Lợi nhuận ròng âm: cột tổng nằm dưới 0
    expect(s.totalNeg[5]).toBe(-200);
    expect(s.totalPos[5]).toBe(0);
  });

  it('doanh thu 0: không NaN, nhãn không có %', () => {
    const s = buildWaterfallSeries(
      buildWaterfallSteps(
        month({
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          opexTotal: 0,
          netBeforeCommission: 0,
          netAfterCommission: 0,
        }),
      ),
      0,
    );
    expect(s.categories[0]).toBe('Doanh thu · 0');
    expect(s.base.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('bước chi phí bán hàng gồm Sale và HHBH; hoa hồng DV không gồm Sale', () => {
    const steps = buildWaterfallSteps(
      month({
        hhbhTotal: 40,
        commissionTotal: 100,
        commissionItems: [
          { categoryKey: 'HOA_HONG_SALE', categoryName: 'Sale', amount: 60 },
        ],
      }),
    );
    expect(steps[3]).toMatchObject({ label: 'Chi phí bán hàng', value: 100 });
    expect(steps[6]).toMatchObject({ label: 'Hoa hồng DV', value: 40 });
  });
});
