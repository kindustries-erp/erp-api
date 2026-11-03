import { buildVinfastFifoPeriodMetrics } from './vinfast-fifo-period-metrics.helper';

const row = (overrides: Record<string, any>) => ({
  part_sku: 'VF-BAT21001011',
  id: 'r',
  direction: 'IN',
  qty: '1',
  unit_cost: '100',
  pre_vat_amount: '100',
  transaction_date: '2026-06-01T12:00:00',
  is_adjustment: false,
  adj_sign: 1,
  item_name: 'HV BATTERY',
  ...overrides,
});

describe('buildVinfastFifoPeriodMetrics', () => {
  it('computes sold amount and COGS from FIFO lots for a normal sale', () => {
    const [metric] = buildVinfastFifoPeriodMetrics(
      [
        row({
          id: 'in-1',
          qty: '10',
          unit_cost: '100',
          pre_vat_amount: '1000',
        }),
        row({
          id: 'out-1',
          direction: 'OUT',
          qty: '4',
          pre_vat_amount: '800',
          transaction_date: '2026-06-05T12:00:00',
        }),
      ],
      'month',
    );

    expect(metric.month).toBe('2026-06');
    expect(metric.qtyBought).toBe(10);
    expect(metric.amountBought).toBe(1000);
    expect(metric.qtySold).toBe(4);
    expect(metric.amountSold).toBe(800);
    expect(metric.totalCogs).toBe(400);
  });

  it('consumes multiple FIFO lots in order when computing COGS', () => {
    const [metric] = buildVinfastFifoPeriodMetrics(
      [
        row({ id: 'in-1', qty: '2', unit_cost: '100', pre_vat_amount: '200' }),
        row({
          id: 'in-2',
          qty: '3',
          unit_cost: '200',
          pre_vat_amount: '600',
          transaction_date: '2026-06-02T12:00:00',
        }),
        row({
          id: 'out-1',
          direction: 'OUT',
          qty: '4',
          pre_vat_amount: '1200',
          transaction_date: '2026-06-05T12:00:00',
        }),
      ],
      'month',
    );

    expect(metric.totalCogs).toBe(600);
  });

  it('reverses COGS and quantity for a return (negative adjustment OUT)', () => {
    const [metric] = buildVinfastFifoPeriodMetrics(
      [
        row({ id: 'in-1', qty: '2', unit_cost: '100', pre_vat_amount: '200' }),
        row({
          id: 'out-1',
          direction: 'OUT',
          qty: '2',
          pre_vat_amount: '300',
          transaction_date: '2026-06-05T12:00:00',
        }),
        row({
          id: 'ret-1',
          direction: 'OUT',
          qty: '1',
          is_adjustment: true,
          adj_sign: -1,
          pre_vat_amount: '150',
          transaction_date: '2026-06-07T12:00:00',
        }),
      ],
      'month',
    );

    expect(metric.qtySold).toBe(1);
    expect(metric.amountSold).toBe(150);
    expect(metric.totalCogs).toBe(100);
  });

  it('only costs the part of a sale that has lots (oversell)', () => {
    const [metric] = buildVinfastFifoPeriodMetrics(
      [
        row({ id: 'in-1', qty: '1', unit_cost: '100', pre_vat_amount: '100' }),
        row({
          id: 'out-1',
          direction: 'OUT',
          qty: '3',
          pre_vat_amount: '450',
          transaction_date: '2026-06-05T12:00:00',
        }),
      ],
      'month',
    );

    expect(metric.qtySold).toBe(3);
    expect(metric.amountSold).toBe(450);
    expect(metric.totalCogs).toBe(100);
  });

  it('groups by day, week (starting Monday), month and year', () => {
    const rows = [
      row({ id: 'in-1', qty: '10', unit_cost: '100', pre_vat_amount: '1000' }),
      row({
        id: 'out-1',
        direction: 'OUT',
        qty: '1',
        pre_vat_amount: '150',
        transaction_date: '2026-06-05T12:00:00',
      }),
    ];

    expect(
      buildVinfastFifoPeriodMetrics(rows, 'day').map((m) => m.month),
    ).toContain('2026-06-05');
    expect(
      buildVinfastFifoPeriodMetrics(rows, 'week').map((m) => m.month),
    ).toContain('2026-06-01');
    expect(
      buildVinfastFifoPeriodMetrics(rows, 'year').map((m) => m.month),
    ).toContain('2026-01-01');
  });
});
