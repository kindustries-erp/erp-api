import { SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';

/** Giá trị đặc biệt: giao dịch chưa gán chi nhánh nào (mảng rỗng) */
export const NO_BRANCH_FILTER = '__BLANK__';

/**
 * Lọc theo nhiều chi nhánh trên cột mảng branch_ids.
 * vals chứa '__BLANK__' thì gồm cả giao dịch không có chi nhánh.
 */
export function applyBranchIdsFilter(
  qb: SelectQueryBuilder<any> | WhereExpressionBuilder,
  vals: string[],
  paramName: string,
  column = 'txn.branchIds',
): void {
  const hasNone = vals.includes(NO_BRANCH_FILTER);
  const realVals = vals.filter((v) => v !== NO_BRANCH_FILTER);
  if (hasNone && realVals.length > 0) {
    qb.andWhere(
      `(${column} && ARRAY[:...${paramName}]::uuid[] OR cardinality(${column}) = 0)`,
      { [paramName]: realVals },
    );
  } else if (hasNone) {
    qb.andWhere(`cardinality(${column}) = 0`);
  } else {
    qb.andWhere(`${column} && ARRAY[:...${paramName}]::uuid[]`, {
      [paramName]: vals,
    });
  }
}

/** Gộp branchIds (mảng) và branchId (cũ, đơn) thành danh sách lọc. */
export function resolveFilterBranchIds(filter: {
  branchIds?: string[];
  branchId?: string;
}): string[] {
  return filter.branchIds ?? (filter.branchId ? [filter.branchId] : []);
}
