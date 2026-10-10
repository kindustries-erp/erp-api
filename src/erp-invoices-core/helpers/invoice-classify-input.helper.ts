import type { ClassifyInvoiceInput } from '../../ai-hub-core/handlers/invoice-ai.handler';
import type { ErpInvoice } from '../entities/erp_invoice.entity';

/** Dựng input phân loại AI từ hóa đơn (kèm các dòng hàng nếu đã load relation `items`). */
export function buildClassifyInvoiceInput(
  invoice: ErpInvoice,
): ClassifyInvoiceInput {
  return {
    invoiceNo: invoice.invoiceNo ?? undefined,
    serialNo: invoice.serialNo ?? undefined,
    sellerName: invoice.sellerName ?? undefined,
    sellerTaxCode: invoice.sellerTaxCode ?? undefined,
    buyerName: invoice.buyerName ?? undefined,
    buyerTaxCode: invoice.buyerTaxCode ?? undefined,
    description: invoice.description ?? undefined,
    notes: invoice.notes ?? undefined,
    totalAmount: Number(invoice.totalAmount || 0),
    items: (invoice.items || []).map((it) => ({
      itemCode: it.itemCode ?? undefined,
      description: it.description ?? undefined,
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      totalAmount: Number(it.totalAmount || 0),
    })),
  };
}
