/**
 * Logic thuần cho backfill "còn phải thu" của phiếu Kgara có chiết khấu.
 * Quy tắc khớp với writer hiện tại (sync-case.service, garage-cashflow-transaction.service):
 * - Có settlement: đã thu = tổng RECEIPT; không có: giữ tien_da_thanh_toan đã lưu.
 * - Còn phải thu = max(0, tien_co_thue (đã là số ròng) − đã thu).
 */

export interface DiscountCaseInput {
  /** tien_co_thue đã lưu, là số ròng sau chiết khấu. */
  tienCoThue: number;
  /** tien_da_thanh_toan đã lưu (dùng khi không có settlement). */
  storedPaid: number;
  hasSettlement: boolean;
  /** Tổng settlement RECEIPT (chỉ dùng khi hasSettlement). */
  receipts: number;
}

export interface DiscountCaseResult {
  paid: number;
  remaining: number;
}

export function computeDiscountCaseFix(
  input: DiscountCaseInput,
): DiscountCaseResult {
  const net = toMoney(input.tienCoThue);
  const paid = input.hasSettlement
    ? toMoney(input.receipts)
    : toMoney(input.storedPaid);
  return { paid, remaining: Math.max(0, toMoney(net - paid)) };
}

export type ForecastAction = 'NOOP' | 'UPDATE' | 'DELETE';

/**
 * Dự thu EXPECTED tự sinh: số còn phải thu mới = 0 thì xóa, khác thì cập nhật, bằng thì giữ.
 */
export function planForecastChange(
  newRemaining: number,
  currentAmount: number,
): ForecastAction {
  if (toMoney(newRemaining) <= 0) return 'DELETE';
  if (toMoney(currentAmount) === toMoney(newRemaining)) return 'NOOP';
  return 'UPDATE';
}

function toMoney(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
