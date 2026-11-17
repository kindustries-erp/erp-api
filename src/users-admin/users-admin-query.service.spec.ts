import { UsersAdminQueryService } from './users-admin-query.service';

describe('UsersAdminQueryService', () => {
  const makeQb = () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'leftJoin',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
      'select',
      'addSelect',
      'groupBy',
      'offset',
      'limit',
    ]) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.clone = jest.fn().mockReturnValue(qb);
    return qb;
  };

  it('listUsers trả trang rỗng đúng dạng v1 { data, total, page, pageSize }', async () => {
    const qb = makeQb();
    const service = new UsersAdminQueryService(
      { createQueryBuilder: () => qb } as never,
      { find: jest.fn() } as never,
    );
    await expect(
      service.listUsers({ page: 2, pageSize: 5 } as never),
    ).resolves.toEqual({ data: [], total: 0, page: 2, pageSize: 5 });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it('getColumnOptions với cột không hỗ trợ trả rỗng, không truy vấn', async () => {
    const createQueryBuilder = jest.fn();
    const service = new UsersAdminQueryService(
      { createQueryBuilder } as never,
      {} as never,
    );
    await expect(service.getColumnOptions('khong-co')).resolves.toEqual({
      items: [],
      total: 0,
      next: null,
    });
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});
