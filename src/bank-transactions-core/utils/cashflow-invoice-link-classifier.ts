import {
  CashflowClassification,
  CashflowPurpose,
} from '../constants/cashflow-attributes.constants';

/**
 * Phân loại dòng tiền theo hóa đơn cấn trừ liên kết (dùng cho backfill Q2/2026 trở đi).
 *
 * Thuần (không DB, không IO). Chỉ kết luận khi TẤT CẢ hóa đơn liên kết cùng hướng
 * với dòng tiền: HĐ bán ra (OUT) ↔ tiền vào, HĐ mua vào (IN) ↔ tiền ra.
 * Hướng lệch hoặc không có hóa đơn → null (để kế toán duyệt tay).
 */

export type InvoiceDirection = 'IN' | 'OUT';

export interface CashflowInvoiceLinkInput {
  isIn: boolean;
  invoiceDirections: InvoiceDirection[];
}

export interface CashflowInvoiceLinkResult {
  classification: CashflowClassification;
  purpose: CashflowPurpose;
  reason: string;
}

export const classifyCashflowByInvoiceLink = (
  input: CashflowInvoiceLinkInput,
): CashflowInvoiceLinkResult | null => {
  const { isIn, invoiceDirections } = input;
  if (invoiceDirections.length === 0) return null;

  if (isIn && invoiceDirections.every((d) => d === 'OUT')) {
    return {
      classification: 'OPERATING',
      purpose: 'CUSTOMER_PAYMENT',
      reason: 'tiền vào khớp HĐ bán ra',
    };
  }

  if (!isIn && invoiceDirections.every((d) => d === 'IN')) {
    return {
      classification: 'OPERATING',
      purpose: 'SUPPLIER_PAYMENT',
      reason: 'tiền ra khớp HĐ mua vào',
    };
  }

  return null;
};
