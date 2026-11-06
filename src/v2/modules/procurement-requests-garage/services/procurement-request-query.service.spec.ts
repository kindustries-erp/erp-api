import { Brackets } from 'typeorm';
import { GarageProcurementRequestQueryService } from './procurement-request-query.service';

describe('GarageProcurementRequestQueryService', () => {
  let service: GarageProcurementRequestQueryService;
  let headersRepo: any;
  let qb: any;

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'req-1',
            requestNo: 'DNM-2026-001',
            title: 'Mua phụ tùng phanh',
            status: 'PENDING_APPROVAL',
            branchId: 'b-1',
          },
        ],
        1,
      ]),
    };

    headersRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };

    service = new GarageProcurementRequestQueryService(
      headersRepo,
      {} as any,
      {} as any,
    );
  });

  it('áp dụng tìm kiếm từ khóa search trên requestNo, title, branchName', async () => {
    const result = await service.list({
      page: 1,
      pageSize: 20,
      search: 'phanh',
    });

    expect(headersRepo.createQueryBuilder).toHaveBeenCalledWith('h');
    expect(qb.where).toHaveBeenCalledWith('h.isDeleted = :notDeleted', {
      notDeleted: false,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
    expect(result.total).toBe(1);
    expect(result.rows[0].requestNo).toBe('DNM-2026-001');
  });

  it('áp dụng lọc theo branchId và status trực tiếp', async () => {
    await service.list({
      branchId: 'b-1',
      status: 'PENDING_APPROVAL',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('h.branchId = :branchId', {
      branchId: 'b-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('h.status = :status', {
      status: 'PENDING_APPROVAL',
    });
  });

  it('áp dụng lọc column_filters dạng JSON từ V2 Table', async () => {
    await service.list({
      column_filters: JSON.stringify({
        status: ['APPROVED', 'PENDING_APPROVAL'],
      }),
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('h.status IN'),
      expect.any(Object),
    );
  });

  it('áp dụng sắp xếp động theo sort', async () => {
    await service.list({
      sort: 'requestDate',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('h.requestDate', 'ASC');
  });

  it('hỗ trợ gọi theo signature cũ (page, pageSize, branchId) để tương thích ngược', async () => {
    const result = await service.list(2, 50, 'b-legacy');

    expect(qb.skip).toHaveBeenCalledWith(50);
    expect(qb.take).toHaveBeenCalledWith(50);
    expect(qb.andWhere).toHaveBeenCalledWith('h.branchId = :branchId', {
      branchId: 'b-legacy',
    });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it('gợi ý giá trị cho cột UUID createdBy sử dụng CAST TEXT an toàn', async () => {
    const fakeQb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '1' }),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ value: '11111111-2222-3333-4444-555555555555' }]),
    };
    fakeQb.clone.mockReturnValue(fakeQb);
    headersRepo.createQueryBuilder.mockReturnValue(fakeQb);

    const result = await service.findColumnOptions(
      'createdBy',
      '',
      1,
      20,
      undefined,
    );

    expect(result.items).toEqual([
      {
        label: '11111111-2222-3333-4444-555555555555',
        value: '11111111-2222-3333-4444-555555555555',
      },
    ]);
    expect(fakeQb.andWhere).toHaveBeenCalledWith(
      "CAST(h.createdBy AS TEXT) IS NOT NULL AND CAST(h.createdBy AS TEXT) != ''",
    );
  });
});
