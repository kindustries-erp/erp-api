import type { FileCategory, FileOwnerType } from '../types/file-owner.types';

/**
 * Hợp đồng mỗi loại chứng từ phải cung cấp để dùng module file.
 * Thêm owner mới = một class policy + một controller mỏng, không sửa core.
 */
export interface FileOwnerPolicyPort {
  readonly ownerType: FileOwnerType;
  /** Nhóm tài liệu owner này cho phép. */
  allowedCategories(): FileCategory[];
  /** Ném NotFoundException nếu chứng từ không tồn tại hoặc đã xóa. */
  assertExists(ownerId: string): Promise<void>;
  /** Ném lỗi nếu trạng thái chứng từ không cho thêm/xóa file (vd. Garage PR chỉ DRAFT). */
  assertCanModify(ownerId: string): Promise<void>;
}
