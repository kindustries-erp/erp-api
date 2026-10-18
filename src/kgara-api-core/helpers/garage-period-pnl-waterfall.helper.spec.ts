import {
  buildWaterfallSeries,
  buildWaterfallSteps,
  type WaterfallSeries,
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

const group = (s: WaterfallSeries, key: string) =>
  s.groups.find((g) => g.group === key)!;

describe('garage-period-pnl-waterfall.helper', () => {
  it('tháng lãi: tổng từ 0, giảm trôi đúng đáy, mỗi nhóm một màu riêng', () => {
    const s = buildWaterfallSeries(buildWaterfallSteps(month()), 1000);
    expect(s.categories[0]).toBe('Doanh thu\n1k · 100,0%');
    expect(group(s, 'revenue').pos[0]).toBe(1000);
    // Giá vốn: trôi 400→1000, đáy 400, phần giảm 600
    expect(s.base[1]).toBe(400);
    expect(group(s, 'cogs').pos[1]).toBe(600);
    // Lợi nhuận gộp và lợi nhuận ròng là tổng màu slate
    expect(group(s, 'profit').pos[2]).toBe(400);
    expect(group(s, 'profit').pos[5]).toBe(250);
    // Mỗi nhóm có màu khác nhau
    const colors = s.groups.map((g) => g.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('tháng lỗ vắt qua 0: cột giảm được tách phần dương và phần âm trong nhóm vận hành', () => {
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
    expect(group(s, 'opex').pos[opex]).toBe(100);
    expect(group(s, 'opex').neg[opex]).toBe(-200);
    // Lợi nhuận ròng âm: cột tổng nằm dưới 0
    expect(group(s, 'profit').neg[5]).toBe(-200);
    expect(group(s, 'profit').pos[5]).toBe(0);
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
    expect(s.categories[0]).toBe('Doanh thu\n0');
    expect(s.base.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('chi phí bán hàng gồm Sale và HHBH; hoa hồng DV không gồm Sale', () => {
    const steps = buildWaterfallSteps(
      month({
        hhbhTotal: 40,
        commissionTotal: 100,
        commissionItems: [
          { categoryKey: 'HOA_HONG_SALE', categoryName: 'Sale', amount: 60 },
        ],
      }),
    );
    expect(steps[3]).toMatchObject({
      label: 'Chi phí bán hàng',
      value: 100,
      group: 'selling',
    });
    expect(steps[6]).toMatchObject({
      label: 'Hoa hồng DV',
      value: 40,
      group: 'commission',
    });
  });
});
