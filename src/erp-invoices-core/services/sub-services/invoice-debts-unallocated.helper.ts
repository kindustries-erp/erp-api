import type { InvoicePartnerDirection } from '../../../common/utils/invoice-partner-key.util';

/**
 * Tiền sao kê đã gắn đối tượng nhưng chưa cấn trừ hóa đơn nào, cộng theo MST của đối tác.
 * Dòng thu (credit > 0) ứng với khách hàng (hóa đơn OUT), dòng chi (debit > 0) ứng với NCC (hóa đơn IN).
 * Mỗi dòng đóng góp phần còn lại: GREATEST(tiền, 0) − tổng đã cấn trừ, không âm.
 *
 * Kết quả: một dòng cho mỗi MST (cột tax_code, unallocated). Không có tham số người dùng trong SQL.
 */
export const buildUnallocatedByTaxSql = (
  direction: InvoicePartnerDirection,
): string => {
  const amountFilter =
    direction === 'OUT' ? 't.credit_amount > 0' : 't.debit_amount > 0';
  return `
    SELECT p.tax_code AS tax_code,
           SUM(GREATEST(0, GREATEST(t.credit_amount, t.debit_amount)
                           - COALESCE(n.net_off, 0))) AS unallocated
    FROM erp_bank_transactions t
    JOIN erp_business_partners p ON p.id = t.partner_id AND p.is_deleted = false
    LEFT JOIN (
      SELECT bank_transaction_id, SUM(net_off_amount) AS net_off
      FROM erp_invoice_voucher_netoff
      GROUP BY bank_transaction_id
    ) n ON n.bank_transaction_id = t.id
    WHERE t.is_deleted = false
      AND p.tax_code IS NOT NULL
      AND ${amountFilter}
    GROUP BY p.tax_code
  `;
};
