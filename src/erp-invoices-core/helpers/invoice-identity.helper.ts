import { Between, FindOptionsWhere, IsNull } from 'typeorm';

import { ErpInvoice } from '../entities/erp_invoice.entity';

export interface InvoiceIdentityInput {
  direction: 'IN' | 'OUT';
  invoiceNo: string;
  serialNo: string | null;
  /**
   * MST đối tác: người bán với hóa đơn mua vào (IN), người mua với hóa đơn bán ra (OUT).
   */
  counterpartyTaxCode: string | null;
  /** Ngày lập dạng `YYYY-MM-DD`. */
  invoiceDate: string;
  /**
   * Tổng tiền thanh toán. Khi truyền vào, chỉ khớp bản ghi có cùng số tiền.
   * Cùng khóa nhưng khác số tiền được coi là hóa đơn khác.
   */
  totalAmount?: string;
}

/**
 * Điều kiện tìm hóa đơn đã có trong DB.
 *
 * Cùng một hóa đơn khi trùng: số hóa đơn, ký hiệu, năm lập, và đối tác (MST người bán với IN, MST người mua với OUT).
 * - Khác năm → hóa đơn khác, lưu riêng (số có thể reset theo năm).
 * - Cùng năm, khác đối tác → hóa đơn khác, lưu riêng.
 * - Cùng năm, cùng đối tác, khác ngày → cùng hóa đơn, không chèn thêm.
 * - Ký hiệu hoặc MST null được khớp bằng IS NULL (không để TypeORM bỏ qua điều kiện null).
 */
/**
 * Chọn hóa đơn gốc khi nhiều bản ghi cùng số/ký hiệu/đối tác (khác năm).
 * - Một ứng viên: trả về chính nó (hành vi cũ).
 * - Nhiều ứng viên: lấy bản ghi có ngày lập gần nhất nhưng không muộn hơn hóa đơn điều chỉnh/thay thế.
 * - Không ứng viên nào thỏa: trả về `null`, không cập nhật nhầm.
 */
export function pickOriginalInvoiceCandidate<
  T extends { invoiceDate: string | Date },
>(candidates: T[], replacingInvoiceDate: string | Date): T | null {
  if (candidates.length <= 1) return candidates[0] ?? null;

  const replacingDay = String(replacingInvoiceDate).slice(0, 10);
  const sorted = [...candidates].sort((a, b) =>
    String(b.invoiceDate)
      .slice(0, 10)
      .localeCompare(String(a.invoiceDate).slice(0, 10)),
  );
  return (
    sorted.find((c) => String(c.invoiceDate).slice(0, 10) <= replacingDay) ??
    null
  );
}

export function buildInvoiceIdentityWhere(
  input: InvoiceIdentityInput,
): FindOptionsWhere<ErpInvoice> {
  const year = input.invoiceDate.slice(0, 4);
  const counterparty = input.counterpartyTaxCode ?? IsNull();

  return {
    direction: input.direction,
    invoiceNo: input.invoiceNo,
    serialNo: input.serialNo ?? IsNull(),
    ...(input.direction === 'IN'
      ? { sellerTaxCode: counterparty }
      : { buyerTaxCode: counterparty }),
    invoiceDate: Between(`${year}-01-01`, `${year}-12-31`),
    ...(input.totalAmount !== undefined
      ? { totalAmount: input.totalAmount }
      : {}),
    isDeleted: false,
  } as FindOptionsWhere<ErpInvoice>;
}
