import type { SelectQueryBuilder } from 'typeorm';
import * as tableQuery from '@/common/utils/table-query';
import { AbstractCashflowVoucherQueryService } from './abstract-cashflow-voucher-query.service';

jest.mock('@/common/utils/table-query', () => ({
  ...jest.requireActual('@/common/utils/table-query'),
  applyTableFilters: jest.fn(),
  applyTableSort: jest.fn(),
  applyListSummaries: jest.fn(),
  findTableColumnOptions: jest.fn(),
}));

interface Entity {
  voucherCode: string;
}

const getManyAndCount = jest.fn();
const qb = {
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount,
} as unknown as SelectQueryBuilder<Entity>;

class TestQuery extends AbstractCashflowVoucherQueryService<string, Entity> {
  protected readonly columns = {
    code: { sql: 'v.voucher_code', type: 'text' as const },
  };
  protected readonly summaryColumns = [{ key: 'amount', sql: 'v.amount' }];
  protected readonly searchColumns = [];
  protected readonly defaultSort = {
    sql: 'v.trans_date',
    direction: 'DESC' as const,
  };
  protected readonly tieBreaker = 'v.id';
  protected createBaseQuery() {
    return qb;
  }
  protected toRow(e: Entity) {
    return e.voucherCode;
  }
}

describe('AbstractCashflowVoucherQueryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tableQuery.applyListSummaries as jest.Mock).mockResolvedValue({
      amount: null,
    });
    getManyAndCount.mockResolvedValue([[{ voucherCode: 'PT-1' }], 45]);
  });

  it('kẹp pageSize tối đa 200 và map sang dòng response', async () => {
    const out = await new TestQuery().findPage({ page: 2, pageSize: 9999 });
    expect(qb.skip).toHaveBeenCalledWith(200);
    expect(qb.take).toHaveBeenCalledWith(200);
    expect(out.items).toEqual(['PT-1']);
    expect(out.pagination.total).toBe(45);
  });

  it('mặc định page 1, pageSize 20', async () => {
    await new TestQuery().findPage({});
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('column-options: cột ngoài whitelist trả trang rỗng', async () => {
    const out = await new TestQuery().findColumnOptions('hack', {});
    expect(tableQuery.findTableColumnOptions).not.toHaveBeenCalled();
    expect(out).toBeDefined();
  });
});
