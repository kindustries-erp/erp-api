import type { DataSource } from 'typeorm';
import type { StockLedgerConfig } from '../contracts/inventory-movements-core.contract';
import {
  loadMovementSumsByItem,
  loadMovementTotals,
} from './stock-ledger-movement-sums.helper';

const config = {
  ledgerScope: 'GARAGE',
  costingMethod: 'WEIGHTED_AVG',
  tables: { balance: 'B', transaction: 'T', costLayer: 'C' } as never,
} as StockLedgerConfig;

function fakeDataSource(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => rows);
  const getRepository = jest.fn(() => ({
    createQueryBuilder: jest.fn(() => qb),
  }));
  return { ds: { getRepository } as unknown as DataSource, qb, getRepository };
}

describe('stock-ledger-movement-sums helper', () => {
  it('returns empty result without querying when no item codes', async () => {
    const { ds, getRepository } = fakeDataSource([]);
    const byItem = await loadMovementSumsByItem(ds, config, []);
    const total = await loadMovementTotals(ds, config, []);
    expect(byItem.size).toBe(0);
    expect(total).toEqual({ qtyReceived: 0, qtyIssued: 0, qtyAdjusted: 0 });
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('maps per-item sums by item code and converts numeric strings', async () => {
    const { ds, qb } = fakeDataSource([
      {
        itemCode: 'A',
        qtyReceived: '5.000',
        qtyIssued: null,
        qtyAdjusted: '-1',
      },
    ]);
    const byItem = await loadMovementSumsByItem(ds, config, ['A']);
    expect(byItem.get('A')).toEqual({
      qtyReceived: 5,
      qtyIssued: 0,
      qtyAdjusted: -1,
    });
    expect(qb.where).toHaveBeenCalledWith('t.ledgerScope = :scope', {
      scope: 'GARAGE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.itemCode IN (:...itemCodes)', {
      itemCodes: ['A'],
    });
    expect(qb.groupBy).toHaveBeenCalledWith('t.itemCode');
  });

  it('keeps adjustment ledger types (incl. cancel) out of received and issued', async () => {
    const { ds, qb } = fakeDataSource([
      { qtyReceived: '0', qtyIssued: '0', qtyAdjusted: '0' },
    ]);
    await loadMovementTotals(ds, config, ['A']);
    const selects = qb.select.mock.calls.concat(qb.addSelect.mock.calls);
    const received = String(selects[0][0]);
    const issued = String(selects[1][0]);
    const adjusted = String(selects[2][0]);
    expect(received).toContain("'ADJUSTMENT', 'ADJUSTMENT_CANCEL'");
    expect(received).toContain('NOT IN');
    expect(issued).toContain('NOT IN');
    expect(adjusted).toContain("IN ('ADJUSTMENT', 'ADJUSTMENT_CANCEL')");
    expect(adjusted).toContain('t.qtyIn - t.qtyOut');
  });
});
