/**
 * Điều kiện SQL: vụ việc V1 (`kgara_cases`, bí danh `caseAlias`) thuộc chi nhánh ERP `param`.
 * V2 `cases_garage` dùng chung id với `kgara_cases` và giữ `branch_id` (chi nhánh ERP), nên lọc qua đó
 * thay vì UUID đơn vị KGara (GR và GN dùng chung một UUID). `param` là placeholder đã bind (`$2`, `:b`).
 */
export const caseInErpBranchSql = (caseAlias: string, param: string): string =>
  `EXISTS (SELECT 1 FROM cases_garage cg WHERE cg.id = ${caseAlias}.id AND cg.branch_id = ${param})`;
