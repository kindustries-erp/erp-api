import { GarageProcurementOrderQueryService } from './procurement-order-query.service';

describe('GarageProcurementOrderQueryService', () => {
  let service: GarageProcurementOrderQueryService;
  let headersRepo: { createQueryBuilder: jest.Mock };
  let usersRepo: { find: jest.Mock };
  let qb: any;

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawOne: jest.fn().mockResolvedValue({ total: '2' }),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ value: 'Công ty A' }, { value: 'Công ty B' }]),
    };
    qb.clone = jest.fn(() => qb);

    headersRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    usersRepo = { find: jest.fn().mockResolvedValue([]) };

    service = new GarageProcurementOrderQueryService(
      {} as any,
      headersRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('list lọc createdBy theo email trong core_users, không theo uuid', async () => {
    await service.list({
      page: 1,
      pageSize: 20,
      column_filters: JSON.stringify({ createdBy: ['a@liouni.com'] }),
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('core_users'),
      expect.any(Object),
    );
  });

  it('list lọc số tiền theo toán tử số (gt)', async () => {
    await service.list({
      page: 1,
      pageSize: 20,
      column_operators: JSON.stringify({
        totalAmount: { operator: 'gt', value: '1000000' },
      }),
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('h.totalAmount'),
      expect.any(Object),
    );
  });

  it('list áp bộ lọc column_filters trên cột status', async () => {
    await service.list({
      page: 1,
      pageSize: 20,
      column_filters: JSON.stringify({ status: ['APPROVED'] }),
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('h.status IN'),
      expect.any(Object),
    );
  });

  it('list sắp xếp theo cột whitelist, mặc định createdAt DESC khi không có sort hợp lệ', async () => {
    await service.list({ page: 1, pageSize: 20, sort: 'orderDate' });
    expect(qb.orderBy).toHaveBeenCalledWith('h.orderDate', 'ASC');

    qb.orderBy.mockClear();
    await service.list({ page: 1, pageSize: 20, sort: 'khong_co_cot' });
    expect(qb.orderBy).toHaveBeenCalledWith('h.createdAt', 'DESC');
  });

  it('findColumnOptions trả danh sách gợi ý và phân trang cho cột hợp lệ', async () => {
    const result = await service.findColumnOptions(
      'supplierName',
      undefined,
      1,
      20,
      undefined,
    );

    expect(headersRepo.createQueryBuilder).toHaveBeenCalledWith('h');
    expect(result).toEqual({
      items: [
        { label: 'Công ty A', value: 'Công ty A' },
        { label: 'Công ty B', value: 'Công ty B' },
      ],
      total: 2,
      next: null,
    });
  });

  it('findColumnOptions trả rỗng và không truy vấn khi cột không nằm trong whitelist', async () => {
    const result = await service.findColumnOptions(
      'password',
      undefined,
      1,
      20,
      undefined,
    );

    expect(headersRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0, next: null });
  });
});
