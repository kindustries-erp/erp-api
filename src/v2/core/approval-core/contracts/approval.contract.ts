/** Thông tin người thực hiện bước duyệt (tên và email tra từ user và nhân viên). */
export interface ApprovalActorInfo {
  /** Họ tên nhân viên liên kết; null nếu user chưa gắn hồ sơ nhân viên. */
  name: string | null;
  email: string | null;
}

/** Cổng tra cứu người thực hiện: module cụ thể cài đặt, core chỉ phụ thuộc giao diện này. */
export interface ApprovalActorResolver {
  resolve(
    actorIds: ReadonlyArray<string | null | undefined>,
  ): Promise<Map<string, ApprovalActorInfo>>;
}

/** Người duyệt hợp lệ của một resource. */
export interface ApproverOption {
  id: string;
  email: string;
}

/** Hình dạng tối thiểu của dòng khóa duyệt (erp_approval_settings) mà core cần đọc. */
export interface ApprovalSettingLike {
  docType: string;
  approvalEnabled: boolean;
}
