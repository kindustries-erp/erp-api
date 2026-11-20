import { GarageCheckpointService } from '../garage-checkpoint.service';
import { listCheckpointVehicles } from '../../helpers/garage-checkpoint-vehicles.query';

jest.mock('../../helpers/garage-checkpoint-vehicles.query', () => ({
  listCheckpointVehicles: jest.fn(),
}));

function createMockQueryBuilder() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawOne: jest
      .fn()
      .mockResolvedValue({ totalCount: '5', totalCases: '7' }),
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  return qb;
}

describe('GarageCheckpointService - getCheckpointCases gom theo XE (group_by)', () => {
  let service: GarageCheckpointService;
  let qb: any;
  const listVehicles = listCheckpointVehicles as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    qb = createMockQueryBuilder();
    service = new GarageCheckpointService({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as any);
  });

  it('group_by=vehicle: items và total theo xe, phân trang theo xe, summary giữ nguyên', async () => {
    listVehicles.mockResolvedValue({
      items: [{ vehicleKey: '51B75695', caseCount: 2, cases: [] }],
      total: 23,
    });

    const res = await service.getCheckpointCases(
      '2026-11-01',
      '2026-11-30',
      2,
      10,
      undefined,
      undefined,
      undefined,
      'ngayHoanThanhCongViec',
      'DESC',
      'quotation',
      true,
      'vehicle',
    );

    expect(res.groupBy).toBe('vehicle');
    expect(res.total).toBe(23);
    expect(res.totalPages).toBe(3);
    expect(res.page).toBe(2);
    expect(res.items).toHaveLength(1);
    expect(res.summary.totalCount).toBe(5);
    expect(res.summary.totalCases).toBe(7);
    // không chạy truy vấn danh sách theo lệnh
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('truyền bộ lọc đã chuẩn hóa xuống truy vấn theo xe', async () => {
    listVehicles.mockResolvedValue({ items: [], total: 0 });

    await service.getCheckpointCases(
      '2026-11-01',
      '2026-11-30',
      1,
      20,
      'abc',
      'remaining',
      'OJ_NGOAI',
      'tienCoThue',
      'ASC',
      'quotation',
      false,
      'vehicle',
    );

    const [, params] = listVehicles.mock.calls[0];
    expect(params).toMatchObject({
      page: 1,
      pageSize: 20,
      sortBy: 'tienCoThue',
      sortOrder: 'ASC',
      filters: {
        dateFrom: '2026-11-01',
        effectiveDateTo: '2026-11-30 23:59:59.999',
        isFunnelMode: true,
        status: 'quotation',
        search: 'abc',
        paymentStatus: 'remaining',
        classification: 'OJ_NGOAI',
      },
    });
  });

  it('mặc định (không group_by) vẫn là danh sách theo lệnh', async () => {
    const res = await service.getCheckpointCases('2026-11-01', '2026-11-30');

    expect(res.groupBy).toBe('case');
    expect(listVehicles).not.toHaveBeenCalled();
    expect(qb.getManyAndCount).toHaveBeenCalled();
  });
});
