/**
 * vinfast-ledger-rules.helper.ts
 *
 * Nguồn sự thật duy nhất cho quy tắc sổ cái phụ tùng VinFast:
 * - Trạng thái hóa đơn được tính vào tồn/FIFO (1 hợp lệ, 2 HĐ thay thế, 3 HĐ điều chỉnh, 5 HĐ gốc bị điều chỉnh).
 *   Loại 4 (HĐ gốc đã bị thay thế, trùng với HĐ thay thế) và 6 (hủy).
 * - Quy tắc số lượng của hóa đơn điều chỉnh.
 * - Thứ tự ghi sổ ổn định (cùng ngày: nhập trước xuất).
 * - Nhận diện mã dịch vụ / công lao động (không phải phụ tùng).
 */

export const VINFAST_VALID_INVOICE_STATUSES = [1, 2, 3, 5] as const;

/** Dùng trong SQL: `i.tax_invoice_status IN ${VINFAST_VALID_STATUS_SQL}` */
export const VINFAST_VALID_STATUS_SQL = `(${VINFAST_VALID_INVOICE_STATUSES.join(', ')})`;

/**
 * Sổ cái đã lọc trạng thái hợp lệ, qty đã nhân adj_sign (điều chỉnh đảo chiều = số âm).
 * Dùng làm bảng nguồn chung cho tồn kho, để mọi màn hình cùng một con số.
 */
export const VINFAST_VALID_LEDGER_SUBQUERY_SQL = `(SELECT l.part_sku, l.direction, l.qty * l.adj_sign AS qty FROM vinfast_parts_ledger l JOIN erp_invoices i ON i.id = l.invoice_id WHERE i.tax_invoice_status IN ${VINFAST_VALID_STATUS_SQL})`;

/** Thứ tự ghi sổ ổn định: cùng ngày thì nhập (IN) trước xuất (OUT), rồi theo số hóa đơn và thời điểm ghi. */
export const VINFAST_LEDGER_ORDER_SQL = `l.transaction_date ASC, CASE WHEN l.direction = 'IN' THEN 0 ELSE 1 END ASC, i.invoice_no ASC, l.created_at ASC, l.id ASC`;

export interface AdjustmentQtyInput {
  quantity: number | string | null | undefined;
  description?: string | null;
}

export interface AdjustmentQtyResult {
  qty: number;
  adjSign: 1 | -1;
}

/**
 * Quy tắc số lượng của hóa đơn điều chỉnh (đồng bộ với reports-core):
 * - Số lượng âm: đảo chiều (trả hàng), qty = |q|, adjSign = -1.
 * - Số lượng dương chỉ được tính khi diễn giải ghi "tăng số lượng".
 * - Còn lại (điều chỉnh đơn giá, không có số lượng): qty = 0, chỉ ảnh hưởng tiền.
 */
export function resolveAdjustmentLedgerQty(
  input: AdjustmentQtyInput,
): AdjustmentQtyResult {
  const quantity = Number(input.quantity);
  if (
    input.quantity === null ||
    input.quantity === undefined ||
    Number.isNaN(quantity)
  ) {
    return { qty: 0, adjSign: 1 };
  }
  if (quantity < 0) {
    return { qty: Math.abs(quantity), adjSign: -1 };
  }
  if (quantity > 0 && /tăng số lượng/i.test(input.description ?? '')) {
    return { qty: quantity, adjSign: 1 };
  }
  return { qty: 0, adjSign: 1 };
}

/** Tiền tố mã dịch vụ / thầu phụ đã biết trên hóa đơn VinFast (EEH/EMT/LFP, lệnh sửa chữa QTS, cứu hộ XSH). */
const VINFAST_SERVICE_SKU_PREFIX = /^VF-(EEH|EMT|LFP|QTS|XSH)/;

/** Mã số thuần 5-10 chữ số: công lao động khi xuất hiện trên hóa đơn bán (không có dòng nhập nào). */
const VINFAST_NUMERIC_SKU = /^VF-\d{5,10}$/;

/**
 * Mã dịch vụ theo tiền tố. Dùng khi nạp danh mục từ hóa đơn mua vào:
 * mã số thuần trên hóa đơn mua vẫn là phụ tùng.
 */
export function isVinfastServicePrefix(sku: string): boolean {
  return VINFAST_SERVICE_SKU_PREFIX.test(sku);
}

/**
 * Mã công lao động (số thuần). Chỉ xuất hiện trên hóa đơn bán nên không vào danh mục phụ tùng.
 */
export function isVinfastLabourCode(sku: string): boolean {
  return VINFAST_NUMERIC_SKU.test(sku);
}
