import {
  GARAGE_FUNNEL_CLASSIFICATION_KEY_SQL,
  GARAGE_FUNNEL_MONTH_SQL,
  buildGarageFunnelSelects,
} from './garage-dashboard-funnel.sql';

describe('buildGarageFunnelSelects (phễu dashboard garage, đếm XE)', () => {
  const selects = buildGarageFunnelSelects();
  const byAlias = (alias: string) => {
    const found = selects.find((s) => s.alias === alias);
    if (!found) throw new Error(`thiếu alias ${alias}`);
    return found.expr;
  };

  it('có đủ alias mà service dashboard đọc', () => {
    expect(selects.map((s) => s.alias)).toEqual([
      'totalCases',
      'totalCount',
      'totalAmount',
      'quotationCount',
      'quotationAmount',
      'inProgressCount',
      'inProgressAmount',
      'completedCount',
      'completedAmount',
      'cancelledCount',
      'cancelledAmount',
    ]);
  });

  it('totalCases là số phiếu; các số lượng còn lại là số xe (COUNT DISTINCT khóa biển)', () => {
    expect(byAlias('totalCases')).toBe('COUNT(c.id)');
    for (const alias of [
      'totalCount',
      'quotationCount',
      'inProgressCount',
      'completedCount',
      'cancelledCount',
    ]) {
      const expr = byAlias(alias);
      expect(expr).toContain('COUNT(DISTINCT');
      expect(expr).toContain(
        "REGEXP_REPLACE(UPPER(c.bien_so_xe), '[^A-Z0-9]', '', 'g')",
      );
    }
  });

  it('tiền vẫn cộng theo phiếu, không đếm distinct', () => {
    expect(byAlias('totalAmount')).toBe('SUM(COALESCE(c.tien_co_thue, 0))');
    for (const alias of [
      'quotationAmount',
      'inProgressAmount',
      'completedAmount',
      'cancelledAmount',
    ]) {
      expect(byAlias(alias)).toMatch(/^SUM\(CASE WHEN .* THEN COALESCE/);
      expect(byAlias(alias)).not.toContain('DISTINCT');
    }
  });

  it('điều kiện giai đoạn khớp định nghĩa checkpoint (báo giá, đang làm, hoàn thành, hủy)', () => {
    expect(byAlias('cancelledCount')).toContain(
      'COUNT(DISTINCT CASE WHEN c.tinh_trang_dich_vu = 9 THEN',
    );
    expect(byAlias('completedCount')).toContain(
      'c.ngay_hoan_thanh_cong_viec IS NOT NULL',
    );
    expect(byAlias('quotationCount')).toContain(
      'ngay_hoan_thanh_cong_viec IS NULL',
    );
    expect(byAlias('inProgressCount')).toContain('NOT (');
  });

  it('khóa nhóm: tháng và phân loại là biểu thức SQL cố định', () => {
    expect(GARAGE_FUNNEL_MONTH_SQL).toContain("'YYYY-MM'");
    expect(GARAGE_FUNNEL_CLASSIFICATION_KEY_SQL).toContain("'SUA_CHUA_CHUNG'");
    expect(GARAGE_FUNNEL_CLASSIFICATION_KEY_SQL).toContain("ELSE 'KHAC'");
  });
});
