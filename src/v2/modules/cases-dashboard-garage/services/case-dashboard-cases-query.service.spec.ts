import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';
import {
  CaseDashboardCasesQueryService,
  normalizePaging,
} from './case-dashboard-cases-query.service';

const RANGE = {
  start: new Date(Date.UTC(2026, 10, 1)),
  end: new Date(Date.UTC(2026, 10, 30, 23, 59, 59)),
};

const ROW = {
  id: 'case-1',
  caseCode: 'PH-001',
  licensePlate: '51A-123.45',
  customerName: 'Khách A',
  status: CaseStatus.QUOTED,
  classification: 'SUA_CHUA_CHUNG',
  receivedAt: null,
  completedAt: null,
  totalAmountWithTax: 1500,
};

type Fake = {
  wheres: string[];
  params: Array<Record<string, unknown>>;
  orderBys: string[];
  offset?: number;
  limit?: number;
};

describe('CaseDashboardCasesQueryService (drill-down lệnh V2)', () => {
  let service: CaseDashboardCasesQueryService;
  let qb: Fake;
  let rows: unknown[];
  let total: number;

  beforeEach(() => {
    rows = [ROW];
    total = 1;
    qb = { wheres: [], params: [], orderBys: [] };
    const self: any = {
      where: jest.fn((cond: string) => {
        qb.wheres.push(cond);
        return self;
      }),
      andWhere: jest.fn((cond: string, params?: Record<string, unknown>) => {
        qb.wheres.push(cond);
        if (params) qb.params.push(params);
        return self;
      }),
      orderBy: jest.fn((expr: string) => {
        qb.orderBys.push(expr);
        return self;
      }),
      addOrderBy: jest.fn((expr: string) => {
        qb.orderBys.push(expr);
        return self;
      }),
      offset: jest.fn((n: number) => {
        qb.offset = n;
        return self;
      }),
      limit: jest.fn((n: number) => {
        qb.limit = n;
        return self;
      }),
      getManyAndCount: jest.fn(() => Promise.resolve([rows, total])),
    };
    const repo = { createQueryBuilder: jest.fn(() => self) };
    service = new CaseDashboardCasesQueryService(repo as any);
  });

  it('luôn lọc phiếu hợp lệ và khoảng ngày theo PERIOD_DATE', async () => {
    await service.listCases({ range: RANGE, page: 1, pageSize: 20 });

    const joined = qb.wheres.join(' AND ');
    expect(joined).toContain('c.is_deleted = false');
    expect(joined).toContain('c.external_deleted_at IS NULL');
    expect(joined).toContain('c.exclude_from_reports = false');
    expect(joined).toContain(
      'COALESCE(c.completed_at, c.issued_at, c.created_at) >=',
    );
    expect(qb.params[0]).toEqual(RANGE);
  });

  it('lọc giai đoạn và phân loại khi có tham số', async () => {
    await service.listCases({
      range: RANGE,
      stage: 'quotation',
      classification: 'OJ_NGOAI',
      page: 1,
      pageSize: 20,
    });

    expect(qb.params).toContainEqual({ status: CaseStatus.QUOTED });
    expect(qb.wheres.join(' AND ')).toContain("IN ('OJ', 'OJ_NGOAI')");
  });

  it('không thêm điều kiện giai đoạn/phân loại khi không truyền', async () => {
    await service.listCases({ range: RANGE, page: 1, pageSize: 20 });

    expect(qb.params.some((p) => 'status' in p)).toBe(false);
    expect(qb.wheres.join(' AND ')).not.toContain(
      'UPPER(TRIM(c.classification))',
    );
  });

  it('phân trang offset/limit và sắp xếp theo ngày kỳ giảm dần, rồi theo id', async () => {
    total = 45;
    const res = await service.listCases({
      range: RANGE,
      page: 3,
      pageSize: 20,
    });

    expect(qb.offset).toBe(40);
    expect(qb.limit).toBe(20);
    expect(qb.orderBys[0]).toBe(
      'COALESCE(c.completed_at, c.issued_at, c.created_at)',
    );
    expect(qb.orderBys[1]).toBe('c.id');
    expect(res.pagination.totalPages).toBe(3);
  });

  it('map lệnh sang DTO có khóa xe, giai đoạn và phân loại', async () => {
    const res = await service.listCases({
      range: RANGE,
      page: 1,
      pageSize: 20,
    });

    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      id: 'case-1',
      caseCode: 'PH-001',
      vehicleKey: '51A12345',
      stage: 'quotation',
      classification: 'SUA_CHUA_CHUNG',
      amount: 1500,
    });
  });

  describe('normalizePaging', () => {
    it('kẹp cỡ trang và trang về giá trị an toàn', () => {
      expect(normalizePaging(0, 500)).toEqual({ page: 1, pageSize: 100 });
      expect(normalizePaging(-3, 0)).toEqual({ page: 1, pageSize: 1 });
      expect(normalizePaging(NaN, NaN)).toEqual({ page: 1, pageSize: 20 });
      expect(normalizePaging(2, 50)).toEqual({ page: 2, pageSize: 50 });
    });
  });
});
