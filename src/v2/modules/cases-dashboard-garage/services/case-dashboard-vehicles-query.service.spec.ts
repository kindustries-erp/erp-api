import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';
import { CaseDashboardVehiclesQueryService } from './case-dashboard-vehicles-query.service';

const RANGE = {
  start: new Date(Date.UTC(2026, 10, 1)),
  end: new Date(Date.UTC(2026, 10, 30, 23, 59, 59)),
};

const row = (
  id: string,
  code: string,
  plate: string | null,
  amount: number,
) => ({
  id,
  caseCode: code,
  licensePlate: plate,
  customerName: 'Khách A',
  status: CaseStatus.QUOTED,
  classification: 'OJ_NGOAI',
  receivedAt: null,
  completedAt: null,
  totalAmountWithTax: amount,
});

type Capture = {
  selects: string[];
  wheres: string[];
  params: Array<Record<string, unknown>>;
  groupBys: string[];
  orderBys: string[];
  offset?: number;
  limit?: number;
};

describe('CaseDashboardVehiclesQueryService (drill-down theo xe V2)', () => {
  let service: CaseDashboardVehiclesQueryService;
  let captures: Capture[];
  let totalRaw: { total: unknown } | undefined;
  let keyRows: Array<{ vehicle_key: string }>;
  let caseRows: unknown[];

  beforeEach(() => {
    captures = [];
    totalRaw = { total: '2' };
    keyRows = [{ vehicle_key: '51B75695' }, { vehicle_key: 'solo' }];
    caseRows = [
      row('c1', 'GN-0025', '51B-756.95', 100),
      row('c2', 'GN-0024', '51B-756.95', 250),
      row('solo', 'GN-0001', null, 40),
    ];
    const repo = {
      createQueryBuilder: jest.fn(() => {
        const cap: Capture = {
          selects: [],
          wheres: [],
          params: [],
          groupBys: [],
          orderBys: [],
        };
        captures.push(cap);
        const self: any = {
          where: (c: string) => (cap.wheres.push(c), self),
          andWhere: (c: string, p?: Record<string, unknown>) => (
            cap.wheres.push(c),
            p && cap.params.push(p),
            self
          ),
          select: (e: string) => (cap.selects.push(e), self),
          addSelect: (e: string) => (cap.selects.push(e), self),
          groupBy: (e: string) => (cap.groupBys.push(e), self),
          orderBy: (e: string) => (cap.orderBys.push(e), self),
          addOrderBy: (e: string) => (cap.orderBys.push(e), self),
          offset: (n: number) => ((cap.offset = n), self),
          limit: (n: number) => ((cap.limit = n), self),
          getRawOne: () => Promise.resolve(totalRaw),
          getRawMany: () => Promise.resolve(keyRows),
          getMany: () => Promise.resolve(caseRows),
        };
        return self;
      }),
    };
    service = new CaseDashboardVehiclesQueryService(repo as any);
  });

  it('total đếm số xe khác nhau (COUNT DISTINCT khóa xe), không đếm lệnh', async () => {
    const res = await service.listVehicles({
      range: RANGE,
      page: 1,
      pageSize: 20,
    });

    expect(captures[0].selects[0]).toContain('COUNT(DISTINCT');
    expect(captures[0].selects[0]).toContain('license_plate');
    expect(res.pagination.total).toBe(2);
  });

  it('phân trang theo xe: offset/limit trên truy vấn nhóm, sắp theo mốc kỳ mới nhất', async () => {
    totalRaw = { total: 45 };
    await service.listVehicles({ range: RANGE, page: 3, pageSize: 20 });

    const page = captures[1];
    expect(page.groupBys).toHaveLength(1);
    expect(page.offset).toBe(40);
    expect(page.limit).toBe(20);
    expect(page.orderBys[0]).toBe('latest_period');
  });

  it('áp cùng bộ lọc hợp lệ, khoảng ngày, giai đoạn và phân loại ở mọi truy vấn', async () => {
    await service.listVehicles({
      range: RANGE,
      stage: 'quotation',
      classification: 'OJ_NGOAI',
      page: 1,
      pageSize: 20,
    });

    for (const cap of captures) {
      const joined = cap.wheres.join(' AND ');
      expect(joined).toContain('c.exclude_from_reports = false');
      expect(joined).toContain("IN ('OJ', 'OJ_NGOAI')");
      expect(cap.params).toContainEqual({ status: CaseStatus.QUOTED });
    }
  });

  it('gom lệnh theo xe: hai lệnh cùng biển là một dòng, phiếu không biển là xe riêng', async () => {
    const res = await service.listVehicles({
      range: RANGE,
      page: 1,
      pageSize: 20,
    });

    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toMatchObject({
      vehicleKey: '51B75695',
      caseCount: 2,
      caseCodes: ['GN-0025', 'GN-0024'],
      amount: 350,
    });
    expect(res.items[1]).toMatchObject({ caseCount: 1, amount: 40 });
  });

  it('lấy lệnh của đúng các xe trong trang (IN danh sách khóa)', async () => {
    await service.listVehicles({ range: RANGE, page: 1, pageSize: 20 });

    const detail = captures[2];
    expect(detail.wheres.join(' AND ')).toContain('IN (:...keys)');
    expect(detail.params).toContainEqual({ keys: ['51B75695', 'solo'] });
  });

  it('không có xe nào thì trả danh sách rỗng và không truy vấn lệnh', async () => {
    totalRaw = { total: 0 };
    keyRows = [];

    const res = await service.listVehicles({
      range: RANGE,
      page: 1,
      pageSize: 20,
    });

    expect(res.items).toEqual([]);
    expect(res.pagination.total).toBe(0);
    expect(captures).toHaveLength(2);
  });
});
