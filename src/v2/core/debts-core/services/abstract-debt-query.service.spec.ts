import type { SelectQueryBuilder } from 'typeorm';
import * as tableQuery from '@/common/utils/table-query';
import { AbstractDebtQueryService } from './abstract-debt-query.service';
import type { DebtListQuery } from '../contracts/debt-list.contract';

jest.mock('@/common/utils/table-query', () => ({
  ...jest.requireActual('@/common/utils/table-query'),
  applyTableFilters: jest.fn(),
  applyTableSort: jest.fn(),
  applyListSummaries: jest.fn(),
  findTableColumnOptions: jest.fn(),
}));

interface Row {
  code: string;
}

const qb = {
  andWhere: jest.fn().mockReturnThis(),
} as unknown as SelectQueryBuilder<Row>;

class TestQuery extends AbstractDebtQueryService<Row, Row> {
  protected readonly columns = {
    code: { sql: 'd.code', type: 'text' as const },
  };
  protected readonly summaryColumns = [{ key: 'balance', sql: 'd.balance' }];
  protected readonly searchColumns = [];
  protected readonly defaultSort = {
    sql: 'd.code',
    direction: 'ASC' as const,
  };
  protected readonly tieBreaker = 'd.id';
  readonly fetched: Array<[number, number]> = [];

  protected createBaseQuery(): SelectQueryBuilder<Row> {
    return qb;
  }

  protected fetchPage(
    _qb: SelectQueryBuilder<Row>,
    offset: number,
    limit: number,
  ) {
    this.fetched.push([offset, limit]);
    return Promise.resolve({ rows: [{ code: 'A' }], total: 45 });
  }

  paging(input: DebtListQuery) {
    return this.resolvePaging(input);
  }
}

describe('AbstractDebtQueryService', () => {
  let service: TestQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestQuery();
    (tableQuery.applyListSummaries as jest.Mock).mockResolvedValue({
      balance: { total: 10, pageSubtotal: 5, cumulative: 5 },
    });
  });

  it('kẹp page và pageSize về khoảng hợp lệ', () => {
    expect(service.paging({})).toEqual({ page: 1, pageSize: 20 });
    expect(service.paging({ page: -3, pageSize: 9999 })).toEqual({
      page: 1,
      pageSize: 200,
    });
    expect(service.paging({ page: '2', pageSize: '0' })).toEqual({
      page: 2,
      pageSize: 20,
    });
  });

  it('findPage trả items, pagination và summaries; offset theo trang', async () => {
    const result = await service.findPage({
      page: 2,
      pageSize: 20,
      summary_keys: 'balance',
    });

    expect(service.fetched).toEqual([[20, 20]]);
    expect(result.items).toEqual([{ code: 'A' }]);
    expect(result.pagination).toMatchObject({ page: 2, pageSize: 20 });
    expect(result.summaries.balance?.total).toBe(10);
    expect(tableQuery.applyListSummaries).toHaveBeenCalledWith(
      qb,
      expect.objectContaining({
        keys: ['balance'],
        page: 2,
        pageSize: 20,
        tieBreaker: 'd.id',
      }),
    );
  });

  it('findColumnOptions: cột ngoài whitelist trả trang rỗng, không truy vấn', async () => {
    const result = await service.findColumnOptions('hack; DROP', {});

    expect(result.items).toEqual([]);
    expect(tableQuery.findTableColumnOptions).not.toHaveBeenCalled();
  });

  it('findColumnOptions: cột hợp lệ loại chính nó khỏi bộ lọc', async () => {
    (tableQuery.findTableColumnOptions as jest.Mock).mockResolvedValue({
      items: [{ label: 'A', value: 'A' }],
      pagination: {},
    });

    await service.findColumnOptions('code', { search: 'a' });

    expect(tableQuery.applyTableFilters).toHaveBeenCalledWith(
      qb,
      {},
      expect.any(Object),
      'col_opt',
      'code',
    );
    expect(tableQuery.findTableColumnOptions).toHaveBeenCalled();
  });
});
