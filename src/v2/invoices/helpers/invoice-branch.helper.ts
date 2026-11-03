/**
 * Chọn danh sách chi nhánh từ DTO.
 * `undefined` = không đổi (cập nhật một phần). `branchIds` ưu tiên hơn `branchId`. Trùng lặp được loại.
 */
export function resolveBranchIds(input: {
  branchIds?: string[];
  branchId?: string | null;
}): string[] | undefined {
  if (input.branchIds !== undefined) return [...new Set(input.branchIds)];
  if (input.branchId !== undefined)
    return input.branchId ? [input.branchId] : [];
  return undefined;
}

/** Chi nhánh chính (cột `branch_id` legacy) là phần tử đầu của `branch_ids`. */
export function primaryBranchId(branchIds: string[]): string | null {
  return branchIds[0] ?? null;
}

/** So sánh hai tập chi nhánh, không phụ thuộc thứ tự. */
export function sameBranchIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
