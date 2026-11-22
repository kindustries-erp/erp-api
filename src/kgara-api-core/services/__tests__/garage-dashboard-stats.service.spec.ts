import { normalizedPlateSql } from '@/common/utils/license-plate';
import { GarageDashboardStatsService } from '../garage-dashboard-stats.service';

type FakeQb = {
  aliases: string[];
  exprs: string[];
  grouped: boolean;
  select: jest.Mock;
  addSelect: jest.Mock;
  leftJoin: jest.Mock;
  innerJoin: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  innerJoinAndSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  getRawMany: jest.Mock;
  getRawOne: jest.Mock;
};

const MONTH_ROWS = [
  { month: '2026-01', totalCount: 3, totalAmount: 300 },
  { month: '2026-02', totalCount: 1, totalAmount: 100 },
];
const FUNNEL_MONTH_CLASS_ROWS = [
  { month: '2026-01', classificationKey: 'SUA_CHUA_CHUNG', totalCount: 2 },
  { month: '2026-01', classificationKey: 'KHAC', totalCount: 1 },
  { month: '2026-02', classificationKey: 'SUA_CHUA_CHUNG', totalCount: 1 },
];
const FUNNEL_CLASS_ROWS = [
  { classificationKey: 'SUA_CHUA_CHUNG', totalCount: 2 },
  { classificationKey: 'KHAC', totalCount: 1 },
];
// Xe A có lệnh cả tháng 1 lẫn tháng 2: tổng distinct toàn kỳ là 3, không phải 4.
const FUNNEL_TOTAL_ROW = { totalCount: 3, totalAmount: 400 };

const STATUS_MONTH_ROWS = [
  { month: '2026-01', statusCode: 1, statusName: 'Báo giá', count: 2 },
  { month: '2026-02', statusCode: 1, statusName: 'Báo giá', count: 1 },
];
const STATUS_OVERALL_ROWS = [
  { statusCode: 1, statusName: 'Báo giá', count: 2, revenue: 0 },
  { statusCode: 3, statusName: 'Hoàn thành', count: 2, revenue: 0 },
];

const CLASS_MONTH_ROWS = [
  { month: '2026-01', classificationKey: 'SUA_CHUA_CHUNG', count: 2 },
  { month: '2026-02', classificationKey: 'SUA_CHUA_CHUNG', count: 1 },
];
const CLASS_OVERALL_ROWS = [
  { classificationKey: 'SUA_CHUA_CHUNG', count: 2, revenue: 0 },
  { classificationKey: 'KHAC', count: 1, revenue: 0 },
];

function resolveRows(aliases: string[]): unknown[] {
  const has = (a: string) => aliases.includes(a);
  if (has('totalCases')) {
    if (has('month') && has('classificationKey'))
      return FUNNEL_MONTH_CLASS_ROWS;
    if (has('month'))
      return MONTH_ROWS.map((r) => ({ ...r, quotationCount: 0 }));
    if (has('classificationKey')) return FUNNEL_CLASS_ROWS;
    return [];
  }
  if (has('statusCode') && has('month')) return STATUS_MONTH_ROWS;
  if (has('statusCode')) return STATUS_OVERALL_ROWS;
  if (has('classificationKey') && has('month')) return CLASS_MONTH_ROWS;
  if (has('classificationKey')) return CLASS_OVERALL_ROWS;
  return [];
}

function createFakeQb(registry: FakeQb[]): FakeQb {
  const qb = {
    aliases: [] as string[],
    exprs: [] as string[],
    grouped: false,
  } as FakeQb;
  const self = () => qb;
  const record = (expr: string, alias: string) => {
    qb.exprs.push(expr);
    qb.aliases.push(alias);
    return qb;
  };
  qb.select = jest.fn((expr: string, alias: string) => record(expr, alias));
  qb.addSelect = jest.fn((expr: string, alias: string) => record(expr, alias));
  qb.leftJoin = jest.fn(self);
  qb.innerJoin = jest.fn(self);
  qb.leftJoinAndSelect = jest.fn(self);
  qb.innerJoinAndSelect = jest.fn(self);
  qb.where = jest.fn(self);
  qb.andWhere = jest.fn(self);
  qb.orderBy = jest.fn(self);
  qb.addOrderBy = jest.fn(self);
  qb.groupBy = jest.fn(() => {
    qb.grouped = true;
    return qb;
  });
  qb.getRawMany = jest.fn(() => Promise.resolve(resolveRows(qb.aliases)));
  qb.getRawOne = jest.fn(() =>
    Promise.resolve(
      qb.aliases.includes('totalCases') &&
        !qb.aliases.includes('month') &&
        !qb.aliases.includes('classificationKey')
        ? FUNNEL_TOTAL_ROW
        : {},
    ),
  );
  registry.push(qb);
  return qb;
}

describe('GarageDashboardStatsService (đếm XE, tổng toàn kỳ distinct)', () => {
  let service: GarageDashboardStatsService;
  let registry: FakeQb[];

  beforeEach(() => {
    registry = [];
    const repo = { createQueryBuilder: jest.fn(() => createFakeQb(registry)) };
    service = new GarageDashboardStatsService(repo as any, repo as any);
  });

  it('tổng phễu toàn kỳ lấy từ truy vấn distinct, không cộng dồn qua các tháng', async () => {
    const result: any = await service.getDashboardStats();

    expect(result.conversionFunnel.totalIntake.count).toBe(3);
    expect(result.conversionFunnel.totalIntake.amount).toBe(400);
    expect(
      result.conversionFunnel.byClassification.SUA_CHUA_CHUNG.totalCount,
    ).toBe(2);
    expect(result.conversionFunnel.byClassification.KHAC.totalCount).toBe(1);
  });

  it('phễu theo tháng giữ số xe distinct trong tháng và phân loại đúng tháng', async () => {
    const result: any = await service.getDashboardStats();

    const jan = result.conversionFunnelByMonth['2026-01'];
    expect(jan.totalIntake.count).toBe(3);
    expect(jan.byClassification.SUA_CHUA_CHUNG.totalCount).toBe(2);
    expect(jan.byClassification.KHAC.totalCount).toBe(1);

    const feb = result.conversionFunnelByMonth['2026-02'];
    expect(feb.byClassification.SUA_CHUA_CHUNG.totalCount).toBe(1);
  });

  it('phân bổ trạng thái toàn kỳ lấy từ truy vấn overall (xe không bị đếm lại qua tháng)', async () => {
    const result: any = await service.getDashboardStats();

    const baoGia = result.statusDistribution.find(
      (s: any) => s.statusName === 'Báo giá',
    );
    expect(baoGia.count).toBe(2);
  });

  it('phân loại toàn kỳ lấy từ truy vấn overall, không cộng dồn các tháng', async () => {
    const result: any = await service.getDashboardStats();

    const sua = result.classificationDistribution.find(
      (c: any) => c.classificationKey === 'SUA_CHUA_CHUNG',
    );
    expect(sua.count).toBe(2);
  });

  it('các biểu thức phễu, trạng thái và phân loại đếm distinct khóa biển số chuẩn hóa', async () => {
    await service.getDashboardStats();

    const countExprs = registry
      .flatMap((qb) =>
        qb.exprs.map((expr, i) => ({ expr, alias: qb.aliases[i] })),
      )
      .filter((x) =>
        ['totalCount', 'quotationCount', 'count'].includes(x.alias),
      );
    expect(countExprs.length).toBeGreaterThan(0);
    for (const { expr } of countExprs) {
      expect(expr).toContain('COUNT(DISTINCT');
      expect(expr).toContain(normalizedPlateSql('c.bien_so_xe'));
    }
  });
});
