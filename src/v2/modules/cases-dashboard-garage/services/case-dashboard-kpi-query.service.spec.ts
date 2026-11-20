import { normalizedPlateSql } from '@/common/utils/license-plate';
import { CaseDashboardKpiQueryService } from './case-dashboard-kpi-query.service';

type FakeQb = {
  selects: Array<{ expr: string; alias: string }>;
  wheres: string[];
  params: Array<Record<string, unknown>>;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getRawOne: jest.Mock;
};

const range = (day: number) => ({
  start: new Date(Date.UTC(2026, 10, day, 0, 0, 0)),
  end: new Date(Date.UTC(2026, 10, day, 23, 59, 59)),
});

function createFakeQb(rowFor: (qb: FakeQb) => Record<string, unknown>): FakeQb {
  const qb = {
    selects: [],
    wheres: [],
    params: [],
  } as unknown as FakeQb;
  const self = () => qb;
  qb.select = jest.fn((expr: string, alias: string) => {
    qb.selects.push({ expr, alias });
    return qb;
  });
  qb.addSelect = jest.fn((expr: string, alias: string) => {
    qb.selects.push({ expr, alias });
    return qb;
  });
  qb.where = jest.fn((cond: string) => {
    qb.wheres.push(cond);
    return qb;
  });
  qb.andWhere = jest.fn((cond: string, params?: Record<string, unknown>) => {
    qb.wheres.push(cond);
    if (params) qb.params.push(params);
    return qb;
  });
  qb.getRawOne = jest.fn(() => Promise.resolve(rowFor(qb)));
  return qb;
}

describe('CaseDashboardKpiQueryService (KPI V2 đếm XE)', () => {
  let service: CaseDashboardKpiQueryService;
  let queries: FakeQb[];
  let rowsInOrder: Array<Record<string, unknown>>;

  beforeEach(() => {
    queries = [];
    rowsInOrder = [];
    const repo = {
      createQueryBuilder: jest.fn(() => {
        const next = rowsInOrder.shift() ?? {};
        const qb = createFakeQb(() => next);
        queries.push(qb);
        return qb;
      }),
    };
    service = new CaseDashboardKpiQueryService(repo as any);
  });

  it('kỳ tháng/tuần/ngày và dự thu map đúng từ hàng SQL', async () => {
    rowsInOrder = [
      {
        totalVehicles: '4',
        totalCases: '6',
        totalAmountWithTax: '1000',
        paidAmount: '250',
        stage_completed_vehicles: '2',
      },
      { totalVehicles: '1', totalCases: '1' },
      { totalVehicles: '0', totalCases: '0' },
      {
        totalVehicles: '3',
        totalAmount: '600',
        class_OJ_NGOAI_vehicles: '2',
        class_OJ_NGOAI_amount: '400',
      },
      { totalVehicles: '7', totalAmount: '900' },
    ];

    const result = await service.getPeriodKpis({
      month: range(1),
      week: range(2),
      day: range(3),
    });

    expect(result.month.totalVehicles).toBe(4);
    expect(result.month.totalCases).toBe(6);
    expect(result.month.collectionRate).toBe(25);
    expect(result.week.totalVehicles).toBe(1);
    expect(result.projectedToday.totalVehicles).toBe(3);
    expect(result.projectedToday.classifications.OJ_NGOAI).toEqual({
      vehicles: 2,
      amount: 400,
    });
    expect(result.projectedMonth.totalVehicles).toBe(7);
  });

  it('mọi truy vấn kỳ lọc phiếu đã xóa mềm, xóa ở KGara và loại khỏi báo cáo', async () => {
    await service.getPeriodKpis({
      month: range(1),
      week: range(2),
      day: range(3),
    });

    for (const qb of queries) {
      const joined = qb.wheres.join(' AND ');
      expect(joined).toContain('c.is_deleted = false');
      expect(joined).toContain('c.external_deleted_at IS NULL');
      expect(joined).toContain('c.exclude_from_reports = false');
    }
  });

  it('số XE dùng distinct khóa biển (license_plate) cho tổng và từng giai đoạn', async () => {
    await service.getPeriodKpis({
      month: range(1),
      week: range(2),
      day: range(3),
    });

    const periodQb = queries[0];
    const totalVehicles = periodQb.selects.find(
      (s) => s.alias === 'totalVehicles',
    );
    expect(totalVehicles?.expr).toContain('COUNT(DISTINCT');
    expect(totalVehicles?.expr).toContain(
      normalizedPlateSql('c.license_plate'),
    );
    const cases = periodQb.selects.find((s) => s.alias === 'totalCases');
    // Tổng kỳ đếm lệnh hoàn thành trong khoảng và không hủy (quy tắc V1), không đếm mọi lệnh trong cửa sổ.
    expect(cases?.expr).toContain('c.completed_at >= :start');
    expect(cases?.expr).toContain("c.status <> 'CANCELLED'");

    const stageVehicles = periodQb.selects.find(
      (s) => s.alias === 'stage_intake_vehicles',
    );
    expect(stageVehicles?.expr).toContain("c.status = 'INTAKE'");
    expect(stageVehicles?.expr).toContain('COUNT(DISTINCT CASE WHEN');
  });

  it('dự thu cả tháng không lọc theo ngày; dự thu hôm nay có lọc ngày', async () => {
    await service.getPeriodKpis({
      month: range(1),
      week: range(2),
      day: range(3),
    });

    const projectedToday = queries[3];
    const projectedMonth = queries[4];
    expect(projectedToday.wheres.join(' ')).toContain(
      'COALESCE(c.issued_at, c.created_at) >= :start',
    );
    expect(projectedMonth.wheres.join(' ')).not.toContain('issued_at');
    expect(projectedMonth.params).toEqual([
      { open: ['INTAKE', 'QUOTED', 'IN_PROGRESS'] },
    ]);
  });

  it('truyền đúng khoảng ngày cho kỳ', async () => {
    await service.getPeriodKpis({
      month: range(1),
      week: range(2),
      day: range(3),
    });

    const monthQb = queries[0];
    expect(monthQb.params[0]).toEqual(range(1));
  });
});
