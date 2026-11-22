import {
  applyListSummaries,
  parseSummaryKeys,
  SUMMARY_KEYS_LIMIT,
} from './table-query.summary';

/** Builder giả: mọi hàm chain trả về chính nó; `getRawOne` lấy lần lượt từ `rawResults`. */
const createFakeBuilder = (rawResults: unknown[]) => {
  const builder: any = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getQuery: jest.fn().mockReturnValue('SELECT 1'),
    getParameters: jest.fn().mockReturnValue({}),
    getRawOne: jest.fn(async () => rawResults.shift()),
    clone: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  builder.clone.mockReturnValue(builder);
  builder.createQueryBuilder.mockReturnValue(builder);
  return builder;
};

const COLUMNS = [
  { key: 'estimatedTotal', sql: 'h.estimatedTotal' },
  { key: 'qty', sql: 'h.qty' },
];

describe('parseSummaryKeys', () => {
  it('splits CSV, trims, drops empty and duplicate keys', () => {
    expect(parseSummaryKeys(' totalAmount, ,totalAmount,qty ')).toEqual([
      'totalAmount',
      'qty',
    ]);
  });

  it('caps the number of keys', () => {
    const raw = Array.from({ length: 15 }, (_, i) => `k${i}`).join(',');
    expect(parseSummaryKeys(raw)).toHaveLength(SUMMARY_KEYS_LIMIT);
  });

  it('returns an empty list for missing or non-string input', () => {
    expect(parseSummaryKeys(undefined)).toEqual([]);
    expect(parseSummaryKeys(['a', 'b'])).toEqual([]);
    expect(parseSummaryKeys('')).toEqual([]);
  });
});

describe('applyListSummaries', () => {
  it('returns null for keys outside the whitelist and runs no query', async () => {
    const qb = createFakeBuilder([]);

    const result = await applyListSummaries(qb, {
      columns: COLUMNS,
      keys: ['unknownKey', 'DROP TABLE'],
      page: 1,
      pageSize: 20,
      tieBreaker: 'h.id',
    });

    expect(result).toEqual({ unknownKey: null, 'DROP TABLE': null });
    expect(qb.getRawOne).not.toHaveBeenCalled();
  });

  it('returns total, page subtotal and cumulative for a page after the first', async () => {
    // Thứ tự query: total, lũy kế đến hết trang (LIMIT 60), subtotal trang 3 (OFFSET 40 LIMIT 20)
    const qb = createFakeBuilder([
      { estimatedTotal: '1000', qty: '9' },
      { s0: '700', s1: '5' },
      { s0: '300', s1: '2' },
    ]);

    const result = await applyListSummaries(qb, {
      columns: COLUMNS,
      keys: ['estimatedTotal', 'qty'],
      page: 3,
      pageSize: 20,
      tieBreaker: 'h.id',
    });

    expect(result).toEqual({
      estimatedTotal: { total: 1000, pageSubtotal: 300, cumulative: 700 },
      qty: { total: 9, pageSubtotal: 2, cumulative: 5 },
    });
    expect(qb.addOrderBy).toHaveBeenCalledWith('h.id', 'ASC');
    expect(qb.limit).toHaveBeenCalledWith(60);
    expect(qb.offset).toHaveBeenCalledWith(40);
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('skips the page slice query on page 1 because it equals the cumulative', async () => {
    const qb = createFakeBuilder([{ estimatedTotal: '500' }, { s0: '120' }]);

    const result = await applyListSummaries(qb, {
      columns: [COLUMNS[0]],
      keys: ['estimatedTotal'],
      page: 1,
      pageSize: 20,
      tieBreaker: 'h.id',
    });

    expect(result).toEqual({
      estimatedTotal: { total: 500, pageSubtotal: 120, cumulative: 120 },
    });
    expect(qb.getRawOne).toHaveBeenCalledTimes(2);
  });

  it('mixes valid and unknown keys in one response', async () => {
    const qb = createFakeBuilder([{ estimatedTotal: '50' }, { s0: '50' }]);

    const result = await applyListSummaries(qb, {
      columns: [COLUMNS[0]],
      keys: ['estimatedTotal', 'nope'],
      page: 1,
      pageSize: 10,
      tieBreaker: 'h.id',
    });

    expect(result).toEqual({
      estimatedTotal: { total: 50, pageSubtotal: 50, cumulative: 50 },
      nope: null,
    });
  });
});
