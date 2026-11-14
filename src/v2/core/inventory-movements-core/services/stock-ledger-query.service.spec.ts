import { StockLedgerQueryService } from './stock-ledger-query.service';

interface FakeQb {
  alias: string;
  [key: string]: any;
}

/** Query builder giả. `alias` quyết định nó được trả cho bảng b (số dư) hay t (thẻ kho). */
function chain(
  alias: 'b' | 't',
  result: {
    many?: unknown[];
    total?: number;
    raw?: unknown;
    rows?: unknown[];
    count?: number;
  },
): FakeQb {
  const qb: FakeQb = { alias, expressionMap: { orderBys: {} } };
  for (const m of [
    'where',
    'andWhere',
    'addSelect',
    'addOrderBy',
    'groupBy',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.select = jest.fn(() => qb);
  qb.orderBy = jest.fn((col: string) => {
    qb.expressionMap.orderBys = { [col]: 'ASC' };
    return qb;
  });
  qb.getManyAndCount = jest.fn(async () => [
    result.many ?? [],
    result.total ?? 0,
  ]);
  qb.getRawOne = jest.fn(async () => result.raw);
  qb.getRawMany = jest.fn(async () => result.rows ?? []);
  qb.getCount = jest.fn(async () => result.count ?? 0);
  return qb;
}

/** Trả query builder theo alias, lấy lần lượt theo thứ tự đã khai báo cho mỗi alias. */
function build(qbs: FakeQb[]) {
  const createQueryBuilder = jest.fn((alias: string) => {
    const i = qbs.findIndex((q) => q.alias === alias);
    return qbs.splice(i, 1)[0];
  });
  const getRepository = jest.fn((_table: unknown) => ({ createQueryBuilder }));
  const svc = new StockLedgerQueryService({ getRepository } as never, {
    ledgerScope: 'GARAGE',
    costingMethod: 'WEIGHTED_AVG',
    tables: { balance: 'B', transaction: 'T', costLayer: 'C' } as never,
  });
  return { svc, getRepository };
}

describe('StockLedgerQueryService', () => {
  it('lists balances scoped by config, with summaries and tab counts in extraData', async () => {
    const list = chain('b', {
      many: [
        {
          id: '1',
          branchId: null,
          itemCode: 'A',
          itemName: 'Item A',
          unit: 'Cái',
          qtyOnHand: '3.000',
          avgCost: '10.00',
          inventoryValue: '30.00',
          updatedAt: new Date(),
        },
      ],
      total: 1,
    });
    const pageMovements = chain('t', {
      rows: [
        {
          itemCode: 'A',
          qtyReceived: '5',
          qtyIssued: '2',
          qtyAdjusted: '-1',
        },
      ],
    });
    const sums = chain('b', {
      raw: { itemCount: '1', totalQty: '3.000', totalValue: '30.00' },
    });
    const tabs = [0, 1, 2, 3].map((i) => chain('b', { count: i }));
    const codes = chain('b', { rows: [{ itemCode: 'A' }] });
    const totalMovements = chain('t', {
      rows: [{ qtyReceived: '5', qtyIssued: '2', qtyAdjusted: '-1' }],
    });
    // Thứ tự gọi bảng b: danh sách, mã khớp tab, tổng, 4 tab; bảng t: trang, tổng
    const { svc } = build([
      list,
      codes,
      sums,
      ...tabs,
      pageMovements,
      totalMovements,
    ]);
    const out = await svc.listBalances({
      stockTab: 'IN_STOCK',
      sort: '-qtyOnHand,bad;x',
      search: 'a_b',
    });
    expect(list.where).toHaveBeenCalledWith('b.ledgerScope = :scope', {
      scope: 'GARAGE',
    });
    expect(list.andWhere).toHaveBeenCalledWith('b.qtyOnHand > 0');
    expect(list.orderBy).toHaveBeenCalledWith('b.qtyOnHand', 'DESC');
    expect(out.items[0].qtyOnHand).toBe(3);
    expect(out.items[0]).toMatchObject({
      qtyReceived: 5,
      qtyIssued: 2,
      qtyAdjusted: -1,
    });
    expect(out.summaries.qtyOnHand).toEqual({
      total: 3,
      pageSubtotal: 3,
      cumulative: 3,
    });
    expect(out.summaries.inventoryValue).toEqual({
      total: 30,
      pageSubtotal: 30,
      cumulative: 30,
    });
    expect(out.summaries.qtyReceived).toMatchObject({ total: 5 });
    expect(out.summaries.qtyIssued).toMatchObject({ total: 2 });
    expect(out.summaries.qtyAdjusted).toMatchObject({ total: -1 });
    expect(out.extraData.tabCounts).toEqual({
      ALL: 0,
      IN_STOCK: 1,
      OUT_OF_STOCK: 2,
      NEGATIVE: 3,
    });
  });

  it('defaults sort to itemCode and skips movement queries when no rows match', async () => {
    const list = chain('b', {});
    const sums = chain('b', { raw: {} });
    const tabs = [0, 1, 2, 3].map(() => chain('b', {}));
    const codes = chain('b', { rows: [] });
    const { svc, getRepository } = build([list, codes, sums, ...tabs]);
    const out = await svc.listBalances({});
    expect(list.orderBy).toHaveBeenCalledWith('b.itemCode', 'ASC');
    expect(out.summaries.qtyReceived).toMatchObject({
      total: 0,
      pageSubtotal: 0,
    });
    expect(out.summaries.qtyIssued).toMatchObject({ total: 0 });
    expect(out.summaries.qtyAdjusted).toMatchObject({ total: 0 });
    // 7 lần dựng truy vấn số dư (danh sách, tổng, 4 tab, mã); không có truy vấn thẻ kho nào
    expect(getRepository).toHaveBeenCalledTimes(7);
    const txCalls = getRepository.mock.calls.filter((c) => c[0] === 'T');
    expect(txCalls).toHaveLength(0);
  });

  it('lists transactions by item within the configured scope', async () => {
    const qb = chain('t', { many: [], total: 0 });
    const { svc } = build([qb]);
    await svc.listTransactions({ itemCode: 'A', dateFrom: '2026-01-01' });
    expect(qb.where).toHaveBeenCalledWith('t.ledgerScope = :scope', {
      scope: 'GARAGE',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.itemCode = :itemCode', {
      itemCode: 'A',
    });
    expect(qb.orderBy).toHaveBeenCalledWith('t.transactionDate', 'DESC');
  });
});
