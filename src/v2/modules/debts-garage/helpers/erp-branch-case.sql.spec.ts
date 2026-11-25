import { caseInErpBranchSql } from './erp-branch-case.sql';

describe('caseInErpBranchSql', () => {
  it('lọc vụ việc V1 theo branch_id của cases_garage cùng id, tham số bind', () => {
    const sql = caseInErpBranchSql('c', '$2');
    expect(sql).toBe(
      'EXISTS (SELECT 1 FROM cases_garage cg WHERE cg.id = c.id AND cg.branch_id = $2)',
    );
    expect(sql).not.toContain('branch_external_id');
  });
});
