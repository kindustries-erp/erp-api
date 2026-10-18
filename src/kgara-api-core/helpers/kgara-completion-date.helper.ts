export const KGARA_STATUS_COMPLETED = 3;

/**
 * Ngày hoàn thành công việc chỉ có hiệu lực khi phiếu ở tình trạng Kết thúc (3).
 * Kgara vẫn giữ NgayHoanThanhCongViec khi phiếu quay về Báo giá/Đang làm/Hủy,
 * nên ERP phải tự xóa để công nợ không tính nhầm phiếu chưa hoàn thành.
 */
export function resolveCompletionDate(
  status: number | string | null | undefined,
  completionDate: Date | null,
): Date | null {
  return Number(status) === KGARA_STATUS_COMPLETED ? completionDate : null;
}
