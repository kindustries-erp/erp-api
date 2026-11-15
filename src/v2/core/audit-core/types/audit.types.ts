/** Dữ liệu một lần ghi nhật ký kiểm toán. Chữ ký giữ nguyên `RecordActionInput` của V1 để caller cũ không đổi. */
export interface RecordActionInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorEmployeeId?: string | null;
  actionType: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  route?: string | null;
  httpMethod?: string | null;
  status?: 'SUCCESS' | 'FAIL';
  message?: string | null;
  uiScreen?: string | null;
  uiAction?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  errorSnapshot?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Số bản ghi trong bộ đệm RAM kích hoạt flush ngay. */
export const AUDIT_BATCH_SIZE = 50;
/** Chu kỳ flush định kỳ (ms). */
export const AUDIT_FLUSH_INTERVAL_MS = 2000;
/** Bộ đệm tối đa khi đưa lại bản ghi vào hàng đợi sau lỗi flush. */
export const AUDIT_REQUEUE_LIMIT = 500;
