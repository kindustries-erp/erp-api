import {
  applyTableSort,
  computeTableSummaries,
  findTableColumnOptions,
  TableColumnMap,
} from './index';

const createFakeQb = () => {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  qb.clone.mockReturnValue(qb);
  return qb;
};

const columns: TableColumnMap = {
  code: { sql: 'bp.code', type: 'text' },
  name: { sql: 'bp.name', type: 'text' },
  created_at: { sql: 'bp.createdAt', type: 'date' },
};

describe('applyTableSort', () => {
  it('orders by whitelisted keys with - meaning descending', () => {
    const qb = createFakeQb();

    applyTableSort(qb, '-code,name', columns, {
      sql: 'bp.createdAt',
      direction: 'DESC',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('bp.code', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('bp.name', 'ASC');
  });

  it('accepts snake_case aliases from the client', () => {
    const qb = createFakeQb();

    applyTableSort(qb, 'created_at', columns, {
      sql: 'bp.code',
      direction: 'ASC',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('bp.createdAt', 'ASC');
  });

  it('drops unknown keys and falls back to the default order', () => {
    const qb = createFakeQb();

    applyTableSort(qb, 'password,-"x"', columns, {
      sql: 'bp.createdAt',
      direction: 'DESC',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('bp.createdAt', 'DESC');
    expect(qb.addOrderBy).not.toHaveBeenCalled();
  });
});

describe('findTableColumnOptions', () => {
  it('returns distinct non-empty values with total and next page', async () => {
    const qb = createFakeQb();
    qb.getRawOne.mockResolvedValue({ total: '41' });
    qb.getRawMany.mockResolvedValue([
      { value: 'Công ty A' },
      { value: 'Công ty B' },
    ]);

    const result = await findTableColumnOptions(
      qb,
      { sql: 'bp.name', type: 'text' },
      undefined,
      1,
      20,
    );

    expect(result).toEqual({
      items: [
        { label: 'Công ty A', value: 'Công ty A' },
        { label: 'Công ty B', value: 'Công ty B' },
      ],
      total: 41,
      next: 2,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      "bp.name IS NOT NULL AND bp.name != ''",
    );
    expect(qb.offset).toHaveBeenCalledWith(0);
    expect(qb.limit).toHaveBeenCalledWith(20);
  });

  it('has no next page on the last page', async () => {
    const qb = createFakeQb();
    qb.getRawOne.mockResolvedValue({ total: '3' });

    const result = await findTableColumnOptions(
      qb,
      { sql: 'bp.name', type: 'text' },
      '',
      1,
      20,
    );

    expect(result.next).toBeNull();
  });
});

describe('computeTableSummaries', () => {
  it('sums each column over the filtered rows, clearing order and paging', async () => {
    const qb = createFakeQb();
    qb.getRawOne.mockResolvedValue({
      amount_total: '1500.50',
      qty_total: null,
    });

    const result = await computeTableSummaries(qb, [
      { key: 'amount_total', sql: 'e.amount' },
      { key: 'qty_total', sql: 'e.qty' },
    ]);

    expect(qb.orderBy).toHaveBeenCalledWith();
    expect(qb.offset).toHaveBeenCalledWith(undefined);
    expect(qb.limit).toHaveBeenCalledWith(undefined);
    expect(qb.select).toHaveBeenCalledWith(
      'COALESCE(SUM(e.amount), 0)',
      'amount_total',
    );
    expect(qb.addSelect).toHaveBeenCalledWith(
      'COALESCE(SUM(e.qty), 0)',
      'qty_total',
    );
    expect(result).toEqual({ amount_total: 1500.5, qty_total: 0 });
  });

  it('returns an empty object without querying when there are no summary columns', async () => {
    const qb = createFakeQb();

    await expect(computeTableSummaries(qb, [])).resolves.toEqual({});
    expect(qb.getRawOne).not.toHaveBeenCalled();
  });
});
