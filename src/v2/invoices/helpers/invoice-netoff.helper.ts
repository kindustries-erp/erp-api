import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** Alias của bảng gộp cấn trừ, dùng trong biểu thức cột và JOIN. */
export const NET_OFF_ALIAS = 'netoff_agg';

/**
 * Gộp số tiền cấn trừ theo hóa đơn. Cấn trừ phiếu (`voucher_netoff`) và cấn trừ điều chỉnh
 * (`adjustment_netoff`, cả hai phía gốc và điều chỉnh) được cộng chung, giống logic v1.
 */
const NET_OFF_SUBQUERY = `(
  SELECT invoice_id, SUM(net_off_amount) AS net_off_sum FROM (
    SELECT invoice_id, net_off_amount FROM erp_invoice_voucher_netoff
    UNION ALL
    SELECT original_invoice_id AS invoice_id, offset_amount AS net_off_amount FROM erp_invoice_adjustment_netoff
    UNION ALL
    SELECT adjusting_invoice_id AS invoice_id, offset_amount AS net_off_amount FROM erp_invoice_adjustment_netoff
  ) unified_netoff GROUP BY invoice_id
)`;

/** Số tiền đã cấn trừ của hóa đơn (0 nếu chưa có). */
export const NET_OFF_SUM_SQL = `COALESCE(${NET_OFF_ALIAS}.net_off_sum, 0)`;

/**
 * Số tiền còn lại. Hóa đơn điều chỉnh (`tax_invoice_status = 3` hoặc tổng âm) lấy phần bù,
 * hóa đơn thường lấy `max(0, tổng - cấn trừ)`. Khớp công thức remaining của v1.
 */
export const REMAINING_AMOUNT_SQL = `CASE
  WHEN e.taxInvoiceStatus = 3 OR e.totalAmount < 0 THEN
    CASE
      WHEN ${NET_OFF_SUM_SQL} >= ABS(e.totalAmount) THEN 0
      ELSE e.totalAmount + ${NET_OFF_SUM_SQL}
    END
  ELSE GREATEST(0, e.totalAmount - ${NET_OFF_SUM_SQL})
END`;

/** Gắn bảng gộp cấn trừ vào query (1 dòng/hóa đơn nên không nhân dòng). */
export const applyNetOffJoin = <T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> =>
  qb.leftJoin(
    NET_OFF_SUBQUERY,
    NET_OFF_ALIAS,
    `${NET_OFF_ALIAS}.invoice_id = e.id`,
  );
