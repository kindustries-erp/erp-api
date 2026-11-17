import { applyAgingHorizonFilter } from './kgara-case-horizon-filter.helper';
import { applyCaseListFilters } from './kgara-case-filter.helper';

const makeQb = () => {
  const qb: any = { andWhere: jest.fn().mockReturnThis() };
  return qb;
};

describe('applyAgingHorizonFilter', () => {
  it('mốc 31–60: điều kiện tuổi nợ trên alias "case"', () => {
    const qb = makeQb();
    applyAgingHorizonFilter(qb, ['overdue31To60']);
    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    const sql = qb.andWhere.mock.calls[0][0] as string;
    expect(sql).toContain('DATE("case".ngay_hoan_thanh_cong_viec)');
    expect(sql).toContain('BETWEEN 31 AND 60');
  });

  it('nhiều mốc nối bằng OR, bọc ngoặc', () => {
    const qb = makeQb();
    applyAgingHorizonFilter(qb, ['nextWeekDue', 'criticalOverdue90Plus']);
    const sql = qb.andWhere.mock.calls[0][0] as string;
    expect(sql.startsWith('((')).toBe(true);
    expect(sql).toContain(' OR ');
    expect(sql).toContain('<= 7');
    expect(sql).toContain('> 90');
  });

  it('bỏ qua giá trị không thuộc danh sách mốc (không chèn SQL tùy ý)', () => {
    const qb = makeQb();
    applyAgingHorizonFilter(qb, ['1=1; DROP TABLE x', 'overdue30To90']);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('không có mốc hợp lệ thì không lọc', () => {
    const qb = makeQb();
    applyAgingHorizonFilter(qb, []);
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('applyCaseListFilters với agingHorizon', () => {
  it('filters JSON có agingHorizon được đưa vào truy vấn danh sách', () => {
    const qb = makeQb();
    applyCaseListFilters(
      qb,
      JSON.stringify({
        agingHorizon: ['overdue61To90'],
        statusTab: ['completed'],
      }),
    );
    const sqls = qb.andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(sqls.some((s: string) => s.includes('BETWEEN 61 AND 90'))).toBe(
      true,
    );
  });
});
