/** Giá trị nguồn đã đổi sang tên field cục bộ (camelCase), JSON-safe. */
export type LinkSourceValues = Record<string, unknown>;

/**
 * Cổng đọc bản ghi nguồn của một FK. Module triển khai (biết bảng/entity cụ thể và ánh xạ
 * cột nguồn → field cục bộ); lõi chỉ gọi qua cổng này. Cổng CHỈ ĐỌC: không bao giờ ghi vào nguồn.
 */
export interface LinkSourcePort {
  /** Giá trị hiện tại của bản ghi nguồn theo id; `null` nếu không có hoặc đã xóa mềm. */
  findValues(fkId: string): Promise<LinkSourceValues | null>;
}
