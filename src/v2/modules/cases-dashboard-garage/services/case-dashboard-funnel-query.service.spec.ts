import { CaseDashboardFunnelQueryService } from './case-dashboard-funnel-query.service';

type FakeQb = {
  aliases: string[];
  exprs: Record<string, string>;
  wheres: string[];
  params: Array<Record<string, unknown>>;
  grouped: boolean;
};

const RANGE = {
  start: new Date(Date.UTC(2026, 5, 1)),
  end: new Date(Date.UTC(2026, 10, 30, 23, 59, 59)),
};

/** Dòng theo tháng: xe A có lệnh ở cả hai tháng nên tổng các tháng (4) lớn hơn tổng toàn kỳ (3). */
const MONTH_ROWS = [
  {
    month: '2026-10',
    totalVehicles: 2,
    totalCases: 2,
    totalAmount: 200,
    stage_quotation_vehicles: 1,
    stage_quotation_amount: 100,
  },
  {
    month: '2026-11',
    totalVehicles: 2,
    totalCases: 2,
    totalAmount: 200,
    stage_completed_vehicles: 2,
    stage_completed_amount: 200,
  },
];
const CLASS_ROWS = [
  {
    classificationKey: 'SUA_CHUA_CHUNG',
    totalVehicles: 2,
    totalCases: 3,
    totalAmount: 300,
  },
  {
    classificationKey: 'KHAC',
    totalVehicles: 1,
    totalCases: 1,
    totalAmount: 100,
  },
];
const OVERALL_ROW = {
  totalVehicles: 3,
  totalCases: 4,
  totalAmount: 400,
  stage_quotation_vehicles: 1,
  stage_quotation_amount: 100,
  stage_completed_vehicles: 2,
  stage_completed_amount: 200,
};

describe('CaseDashboardFunnelQueryService (phễu V2 đếm XE)', () => {
  let service: CaseDashboardFunnelQueryService;
  let queries: FakeQb[];

  beforeEach(() => {
    queries = [];
    const repo = {
      createQueryBuilder: jest.fn(() => {
        const qb: FakeQb = {
          aliases: [],
          exprs: {},
          wheres: [],
          params: [],
          grouped: false,
        };
        queries.push(qb);
        const self: any = {
          select: jest.fn((expr: string, alias: string) => {
            qb.aliases.push(alias);
            qb.exprs[alias] = expr;
            return self;
          }),
          addSelect: jest.fn((expr: string, alias: string) => {
            qb.aliases.push(alias);
            qb.exprs[alias] = expr;
            return self;
          }),
          where: jest.fn((cond: string) => {
            qb.wheres.push(cond);
            return self;
          }),
          andWhere: jest.fn(
            (cond: string, params?: Record<string, unknown>) => {
              qb.wheres.push(cond);
              if (params) qb.params.push(params);
              return self;
            },
          ),
          groupBy: jest.fn(() => {
            qb.grouped = true;
            return self;
          }),
          getRawOne: jest.fn(() => Promise.resolve(OVERALL_ROW)),
          getRawMany: jest.fn(() => {
            if (qb.aliases.includes('month'))
              return Promise.resolve(MONTH_ROWS);
            if (qb.aliases.includes('classificationKey')) {
              return Promise.resolve(CLASS_ROWS);
            }
            return Promise.resolve([]);
          }),
        };
        return self;
      }),
    };
    service = new CaseDashboardFunnelQueryService(repo as any);
  });

  it('tổng toàn kỳ là distinct trên cả kỳ, không bằng tổng các tháng', async () => {
    const funnel = await service.getFunnel(RANGE);

    const monthSum = Object.values(funnel.byMonth).reduce(
      (sum, b) => sum + b.totalVehicles,
      0,
    );
    expect(funnel.overall.totalVehicles).toBe(3);
    expect(monthSum).toBe(4);
    expect(funnel.overall.totalCases).toBe(4);
  });

  it('theo tháng và theo phân loại map đúng số liệu và tỷ lệ giai đoạn', async () => {
    const funnel = await service.getFunnel(RANGE);

    expect(Object.keys(funnel.byMonth).sort()).toEqual(['2026-10', '2026-11']);
    expect(funnel.byMonth['2026-10'].stages.quotation).toEqual({
      vehicles: 1,
      amount: 100,
      rate: 50,
    });
    expect(funnel.byClassification.SUA_CHUA_CHUNG.totalVehicles).toBe(2);
    expect(funnel.byClassification.OJ_NGOAI.totalVehicles).toBe(0);
    expect(funnel.overall.stages.completed.vehicles).toBe(2);
  });

  it('tổng toàn kỳ không GROUP BY; tháng nhóm theo TO_CHAR; phân loại nhóm theo CASE', async () => {
    await service.getFunnel(RANGE);

    const [overallQb, monthQb, classQb] = queries;
    expect(overallQb.grouped).toBe(false);
    expect(monthQb.grouped).toBe(true);
    expect(monthQb.exprs.month).toContain('TO_CHAR(');
    expect(classQb.grouped).toBe(true);
    expect(classQb.exprs.classificationKey).toContain("'OJ_NGOAI'");
  });

  it('giai đoạn dùng trạng thái cases_garage; số xe là distinct khóa biển', async () => {
    await service.getFunnel(RANGE);

    const overallQb = queries[0];
    expect(overallQb.exprs.stage_quotation_vehicles).toContain(
      "c.status = 'QUOTED'",
    );
    expect(overallQb.exprs.stage_completed_vehicles).toContain(
      "c.status = 'COMPLETED'",
    );
    expect(overallQb.exprs.totalVehicles).toContain('COUNT(DISTINCT');
    expect(overallQb.exprs.totalVehicles).toContain(
      "REGEXP_REPLACE(UPPER(c.license_plate), '[^A-Z0-9]', '', 'g')",
    );
    expect(overallQb.exprs.totalCases).toBe('COUNT(c.id)');
  });

  it('mọi truy vấn lọc phiếu đã xóa mềm, xóa phía KGara và loại khỏi báo cáo; truyền khoảng ngày', async () => {
    await service.getFunnel(RANGE);

    for (const qb of queries) {
      const joined = qb.wheres.join(' AND ');
      expect(joined).toContain('c.is_deleted = false');
      expect(joined).toContain('c.external_deleted_at IS NULL');
      expect(joined).toContain('c.exclude_from_reports = false');
      expect(qb.params[0]).toEqual(RANGE);
    }
  });
});
