import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';
import { PERIOD_DATE, applyCaseFilters } from './case-dashboard.sql';

const RANGE = { start: new Date(2026, 10, 1), end: new Date(2026, 10, 30) };

function run(over: { stage?: any; classification?: any } = {}) {
  const wheres: string[] = [];
  const params: Array<Record<string, unknown>> = [];
  const qb: any = {
    where: jest.fn((cond: string) => (wheres.push(cond), qb)),
    andWhere: jest.fn((cond: string, p?: Record<string, unknown>) => {
      wheres.push(cond);
      if (p) params.push(p);
      return qb;
    }),
  };
  applyCaseFilters(qb, { range: RANGE, ...over });
  return { sql: wheres.join(' AND '), params };
}

describe('applyCaseFilters (bộ lọc dùng chung của drill-down)', () => {
  it('luôn lọc phiếu hợp lệ và khoảng ngày theo mốc kỳ', () => {
    const { sql, params } = run();

    expect(sql).toContain('c.is_deleted = false');
    expect(sql).toContain('c.external_deleted_at IS NULL');
    expect(sql).toContain('c.exclude_from_reports = false');
    expect(sql).toContain(`${PERIOD_DATE} >= :start`);
    expect(params).toContainEqual({ start: RANGE.start, end: RANGE.end });
  });

  it('không thêm điều kiện giai đoạn/phân loại khi không truyền', () => {
    const { sql, params } = run();

    expect(sql).not.toContain('c.status =');
    expect(sql).not.toContain('classification');
    expect(params).toHaveLength(1);
  });

  it('lọc giai đoạn theo CaseStatus và phân loại theo điều kiện SQL cố định', () => {
    const { sql, params } = run({
      stage: 'quotation',
      classification: 'OJ_NGOAI',
    });

    expect(sql).toContain('c.status = :status');
    expect(params).toContainEqual({ status: CaseStatus.QUOTED });
    expect(sql).toContain("IN ('OJ', 'OJ_NGOAI')");
  });
});
