/**
 * Công tắc chuyển nguồn đọc/ghi Thu chi garage (task 2.8).
 * CASHFLOW_GARAGE_SOURCE=new: đọc/ghi qua cashflow_* (lõi mới).
 * Mặc định (không đặt hoặc giá trị khác): legacy, giữ hành vi cũ.
 * Đọc biến môi trường mỗi lần gọi để bật/tắt không cần sửa code. Xóa cùng đợt với P6.
 */
export const CASHFLOW_GARAGE_SOURCE_ENV = 'CASHFLOW_GARAGE_SOURCE';

export function isNewCashflowSource(): boolean {
  return process.env[CASHFLOW_GARAGE_SOURCE_ENV] === 'new';
}
