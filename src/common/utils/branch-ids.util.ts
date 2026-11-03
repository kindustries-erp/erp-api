/**
 * Cặp cột chi nhánh của hóa đơn và sao kê.
 * `branch_ids` là nguồn chuẩn; `branch_id` là bản sao của phần tử đầu (dữ liệu cũ, còn đọc được).
 * Mảng rỗng nghĩa là chưa gán chi nhánh.
 */
export interface BranchColumns {
  branchIds?: string[] | null;
  branchId?: string | null;
}

/** Chuẩn hóa để hai cột luôn khớp nhau: `branchId` = phần tử đầu của `branchIds`. */
export function normalizeBranchColumns(input: BranchColumns): {
  branchIds: string[];
  branchId: string | null;
} {
  let branchIds: string[];
  if (input.branchIds != null) {
    branchIds = [...new Set(input.branchIds)];
  } else {
    branchIds = input.branchId ? [input.branchId] : [];
  }
  return { branchIds, branchId: branchIds[0] ?? null };
}

/** Danh sách chi nhánh hiệu lực: ưu tiên `branchIds`, dữ liệu cũ chỉ có `branchId` thì dùng `branchId`. */
export function readBranchIds(row: BranchColumns): string[] {
  if (row.branchIds?.length) return row.branchIds;
  return row.branchId ? [row.branchId] : [];
}
