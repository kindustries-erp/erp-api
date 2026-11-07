/**
 * Biểu thức SQL dùng chung cho lớp tương thích. Alias: f = cashflow_forecasts, ext = cashflow_garage_forecast_ext, kc = kgara_cases.
 * Tương đương với các điều kiện trên payment_status cũ (xem toLegacyPaymentStatus).
 * Xóa cùng đợt với route cũ (P6).
 */

/** Nhãn trạng thái cũ, suy từ chiều dòng tiền và trạng thái mới. */
export const PAYMENT_STATUS_SQL =
  "CASE WHEN f.status = 'CANCELLED' THEN 'CANCELLED' " +
  "WHEN f.status = 'SETTLED' THEN 'PAID' " +
  "WHEN f.direction = 'IN' THEN 'EXPECTED' " +
  "WHEN f.status IN ('OPEN', 'PARTIAL') THEN 'APPROVED' " +
  "ELSE 'PENDING' END";

/** Thực thu: dự thu đã thu đủ (gồm cả phiếu thu cũ không có nhãn, đã quy ước là đã thu). */
export const ACTUAL_IN_SQL = "f.direction = 'IN' AND f.status = 'SETTLED'";
/** Thực chi: dự chi đã chi đủ. */
export const ACTUAL_OUT_SQL = "f.direction = 'OUT' AND f.status = 'SETTLED'";
/** Dự chi còn phải chi: chưa settled và chưa hủy. */
export const PLANNED_OUT_SQL =
  "f.direction = 'OUT' AND f.status NOT IN ('SETTLED', 'CANCELLED')";
/** Dự thu chưa thu: chưa settled và chưa hủy. */
export const PENDING_IN_SQL =
  "f.direction = 'IN' AND f.status NOT IN ('SETTLED', 'CANCELLED')";
