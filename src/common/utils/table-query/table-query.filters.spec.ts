import { Brackets } from 'typeorm';
import { applyTableFilters, TableColumnMap } from './index';

/** Fake query builder: ghi lại mọi điều kiện đã thêm để kiểm tra SQL. */
const createFakeQb = () => {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };
  return qb;
};

/** Chạy điều kiện Brackets bên trong để lấy SQL của nhóm OR. */
const expandBrackets = (condition: unknown) => {
  const nested: any = {
    clauses: [] as string[],
    where(sql: string) {
      this.clauses.push(sql);
      return this;
    },
    orWhere(sql: string) {
      this.clauses.push(`OR ${sql}`);
      return this;
    },
  };
  (condition as any).whereFactory(nested);
  return nested.clauses as string[];
};

const columns: TableColumnMap = {
  code: { sql: 'bp.code', type: 'text' },
  status: { sql: 'bp.status', type: 'status' },
  amount: { sql: 'bp.amount', type: 'number' },
  createdAt: { sql: 'bp.createdAt', type: 'date' },
};

const whereSqls = (qb: any): string[] =>
  qb.andWhere.mock.calls.map(([sql]: [unknown]) => sql);

describe('applyTableFilters', () => {
  it('ignores keys that are not whitelisted (no SQL injection surface)', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      {
        columnOperators: {
          'bp.code; DROP TABLE x': { operator: 'contains', value: 'a' },
        },
      },
      columns,
      'p',
    );

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('applies text operators with ILIKE and exact comparisons', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      {
        columnOperators: {
          code: { operator: 'starts_with', value: 'KH' },
          status: { operator: 'not_equals', value: 'ACTIVE' },
        },
      },
      columns,
      'p',
    );

    expect(whereSqls(qb)).toEqual([
      'bp.code ILIKE :p_operator_0',
      'LOWER(bp.status) <> LOWER(:p_operator_1)',
    ]);
  });

  it('applies number operators as typed comparisons', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      {
        columnOperators: {
          amount: { operator: 'between', value: '10', valueTo: '20' },
        },
      },
      columns,
      'p',
    );

    expect(qb.andWhere).toHaveBeenCalledWith(
      'bp.amount BETWEEN :p_operator_0_from AND :p_operator_0_to',
      { p_operator_0_from: 10, p_operator_0_to: 20 },
    );
  });

  it('rejects a text operator on a number column and a number operator on text', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      {
        columnOperators: {
          amount: { operator: 'contains', value: '1' },
          code: { operator: 'gt', value: '1' },
        },
      },
      columns,
      'p',
    );

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('drops a number operator whose value is not a finite number', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { columnOperators: { amount: { operator: 'gte', value: 'abc' } } },
      columns,
      'p',
    );

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('applies date operators with whole-day Vietnam boundaries', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      {
        columnOperators: {
          createdAt: { operator: 'eq', value: '2026-01-15' },
        },
      },
      columns,
      'p',
    );

    const [sql, params] = qb.andWhere.mock.calls[0];
    expect(sql).toBe(
      'bp.createdAt BETWEEN :p_operator_0_from AND :p_operator_0_to',
    );
    expect(params.p_operator_0_from.toISOString()).toBe(
      '2026-01-14T17:00:00.000Z',
    );
    expect(params.p_operator_0_to.toISOString()).toBe(
      '2026-01-15T16:59:59.999Z',
    );
  });

  it('applies date ranges to any date column, not only createdAt', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { dateRanges: { createdAt: { from: '2026-01-01', to: '2026-01-31' } } },
      columns,
      'p',
    );

    expect(whereSqls(qb)).toEqual([
      'bp.createdAt >= :p_range_0_from',
      'bp.createdAt <= :p_range_0_to',
    ]);
  });

  it('treats __BLANK__ as NULL or empty for text and NULL only for number', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      {
        columnFilters: {
          code: ['__BLANK__'],
          amount: ['__BLANK__'],
        },
      },
      columns,
      'p',
    );

    expect(whereSqls(qb)).toEqual([
      "(bp.code IS NULL OR bp.code = '')",
      'bp.amount IS NULL',
    ]);
  });

  it('matches selected number values as numbers, skipping invalid ones', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { columnFilters: { amount: ['10', 'abc', '20'] } },
      columns,
      'p',
    );

    expect(qb.andWhere).toHaveBeenCalledWith(
      'CAST(bp.amount AS TEXT) IN (:...p_select_0)',
      { p_select_0: [10, 20] },
    );
  });

  it('combines blank and selected values in one OR group', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { columnFilters: { status: ['ACTIVE', '__BLANK__'] } },
      columns,
      'p',
    );

    const [condition] = qb.andWhere.mock.calls[0];
    expect(condition).toBeInstanceOf(Brackets);
    expect(expandBrackets(condition)).toEqual([
      'bp.status IN (:...p_select_0)',
      "OR (bp.status IS NULL OR bp.status = '')",
    ]);
  });

  it('matches all rows with a keyword when __ALL_MATCHING__ carries a search term', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { columnFilters: { code: ['__ALL_MATCHING__', 'KH'] } },
      columns,
      'p',
    );

    const [condition] = qb.andWhere.mock.calls[0];
    expect(expandBrackets(condition)).toEqual(['bp.code ILIKE :p_select_0_0']);
  });

  it('skips the column named in exceptColumn (cascading options)', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { columnFilters: { code: ['KH-001'], status: ['ACTIVE'] } },
      columns,
      'p',
      'code',
    );

    expect(whereSqls(qb)).toEqual(['bp.status IN (:...p_select_1)']);
  });

  it('casts number and date columns to text for column search', () => {
    const qb = createFakeQb();

    applyTableFilters(
      qb,
      { columnSearch: { amount: '12', code: 'KH' } },
      columns,
      'p',
    );

    const [amountCond] = qb.andWhere.mock.calls[0];
    const [codeCond] = qb.andWhere.mock.calls[1];
    expect(expandBrackets(amountCond)).toEqual([
      'CAST(bp.amount AS TEXT) ILIKE :p_search_0_0',
    ]);
    expect(expandBrackets(codeCond)).toEqual(['bp.code ILIKE :p_search_1_0']);
  });
});
