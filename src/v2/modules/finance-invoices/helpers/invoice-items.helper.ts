import { InvoiceItemDto } from '../dto/invoice-item.dto';
import { extractStandardItemCode } from './invoice-item-code.helper';
import { normalizeUom } from './uom.helper';

export interface InvoiceItemContext {
  direction: string;
  sellerName?: string | null;
  sellerTaxCode?: string | null;
}

/** Dòng hàng đã sẵn sàng ghi xuống DB (chưa có `invoiceId`). */
export type InvoiceItemRow = {
  invoiceSubcategory: string;
  description: string | null;
  unit: string | null;
  itemCode: string | null;
  quantity: string | null;
  unitPrice: string | null;
  preVatAmount: string;
  vatRate: string | null;
  vatAmount: string;
  discountAmount: string;
  totalAmount: string;
};

/**
 * Dựng các dòng hàng từ DTO: ép kiểu số, chuẩn hóa ĐVT, và gán mã hàng hóa.
 * Khi cập nhật, truyền `existingItems` để giữ lại mã hàng cũ theo diễn giải (Preserve Guard).
 */
export function buildInvoiceItems(
  dtoItems: InvoiceItemDto[],
  ctx: InvoiceItemContext,
  existingItems: { description: string | null; itemCode: string | null }[] = [],
): InvoiceItemRow[] {
  const existingCodeByDescription = new Map<string, string>();
  for (const item of existingItems) {
    const key = item.description?.trim();
    if (key && item.itemCode) existingCodeByDescription.set(key, item.itemCode);
  }

  return dtoItems.map((i) => {
    const description = i.description ?? null;
    const existingCode = description
      ? existingCodeByDescription.get(description.trim())
      : undefined;
    const resolved = extractStandardItemCode({
      description,
      itemCode: i.itemCode ?? existingCode ?? null,
      existingItemCode: existingCode ?? null,
      unit: i.unit ?? null,
      discountAmount: i.discountAmount ?? null,
      preVatAmount: i.preVatAmount ?? null,
      sellerName: ctx.sellerName,
      sellerTaxCode: ctx.sellerTaxCode,
      direction: ctx.direction,
    });

    return {
      invoiceSubcategory: i.invoiceSubcategory ?? 'NORMAL',
      description,
      unit: normalizeUom(i.unit),
      itemCode: resolved.itemCode || existingCode || i.itemCode || null,
      quantity: i.quantity != null ? String(i.quantity) : null,
      unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
      preVatAmount: String(i.preVatAmount ?? 0),
      vatRate: i.vatRate != null ? String(i.vatRate) : null,
      vatAmount: String(i.vatAmount ?? 0),
      discountAmount: String(i.discountAmount ?? 0),
      totalAmount: String(i.totalAmount ?? 0),
    };
  });
}
