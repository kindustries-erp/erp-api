/** Dữ liệu thô từ body đã qua pipe kiểm tra (code, name, is_active, extraData). */
export type BranchInput = Record<string, unknown>;

/** Tham chiếu nhẹ tới chi nhánh, dùng ở lõi khác thay cho entity cụ thể. */
export interface BranchRef {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

/** Một bảng còn tham chiếu tới chi nhánh. */
export interface BranchReference {
  table: string;
  count: number;
}

/**
 * Cổng kiểm tra chi nhánh còn được tham chiếu hay không. Module triển khai
 * (biết danh sách bảng cụ thể); lõi chỉ gọi qua cổng này.
 */
export abstract class BranchReferencePort {
  abstract findReferences(branchId: string): Promise<BranchReference[]>;
}
