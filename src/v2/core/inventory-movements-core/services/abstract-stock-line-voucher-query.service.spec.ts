import { AbstractStockLineVoucherQueryService } from './abstract-stock-line-voucher-query.service';

class TestQueryService extends AbstractStockLineVoucherQueryService<any, any> {
  protected readonly headerEntity = 'Header' as never;
  protected readonly lineEntity = 'Line' as never;
  protected readonly voucherPrefix = 'TST';
}

const setup = (rows: unknown[], total: number) => {
  const repo = { findAndCount: jest.fn(async () => [rows, total]) };
  const ds: any = { getRepository: jest.fn(() => repo) };
  return { svc: new TestQueryService(ds, {} as any), repo };
};

describe('AbstractStockLineVoucherQueryService.findAll', () => {
  it('trả { items, pagination } chuẩn, không có key phẳng cũ', async () => {
    const { svc } = setup([{ id: 'a' }], 45);
    const res = await svc.findAll({ page: 2, pageSize: 20 });
    expect(res).toEqual({
      items: [{ id: 'a' }],
      pagination: {
        page: 2,
        pageSize: 20,
        total: 45,
        totalPages: 3,
        next: 3,
        previous: 1,
      },
    });
    expect(res).not.toHaveProperty('total');
  });

  it('danh sách rỗng: totalPages = 1, không next/previous', async () => {
    const { svc } = setup([], 0);
    const res = await svc.findAll({});
    expect(res.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      next: null,
      previous: null,
    });
  });

  it('trang cuối: next = null', async () => {
    const { svc } = setup([{}], 41);
    const res = await svc.findAll({ page: 3, pageSize: 20 });
    expect(res.pagination.next).toBeNull();
    expect(res.pagination.previous).toBe(2);
  });

  it('áp search/status, loại xóa mềm và kẹp pageSize ≤ 200', async () => {
    const { svc, repo } = setup([], 0);
    await svc.findAll({ search: 'GSR', status: 'POSTED', pageSize: 999 });
    const arg = (repo.findAndCount.mock.calls[0] as any[])[0];
    expect(arg.take).toBe(200);
    expect(arg.skip).toBe(0);
    expect(arg.where.isDeleted).toBe(false);
    expect(arg.where.status).toBe('POSTED');
    expect(arg.where.voucherNo).toBeDefined();
  });
});
