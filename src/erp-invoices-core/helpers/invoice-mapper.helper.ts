import { ErpInvoice } from '../entities/erp_invoice.entity';

/**
 * Map a numeric/string VAT rate stored in DB to a fraction for Excel export.
 * e.g. "0.08" or 8 → 0.08
 */
export function parseVatRateForDisplay(val: any): number | string {
  if (val == null || val === '') return '';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return Math.abs(n) > 1 ? n / 100 : n;
}

/**
 * Format a numeric/string VAT rate stored in DB to a percentage string for Excel export.
 * e.g. "0.08" or 8 or "8" -> "8%", 0.1 -> "10%", 0 -> "0%", "KCT" -> "KCT", null -> ""
 */
export function formatVatRate(val: any): string {
  if (val == null || val === '') return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (trimmed.endsWith('%')) return trimmed;
    const num = Number(trimmed);
    if (isNaN(num)) return trimmed;
    const rate =
      Math.abs(num) <= 1 && num !== 0 ? Math.round(num * 10000) / 100 : num;
    return `${rate}%`;
  }
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    const rate =
      Math.abs(val) <= 1 && val !== 0 ? Math.round(val * 10000) / 100 : val;
    return `${rate}%`;
  }
  return String(val);
}

/**
 * Map an ErpInvoice entity (possibly with a computed netOffAmount) to a safe DTO
 * where all numeric columns are serialised as strings to prevent precision loss.
 */
export function toInvoiceDto(invoice: ErpInvoice & { netOffAmount?: string }) {
  return {
    ...invoice,
    netOffAmount: invoice.netOffAmount || '0',
    preVatAmount:
      invoice.preVatAmount != null ? String(invoice.preVatAmount) : '0',
    vatRate: invoice.vatRate != null ? String(invoice.vatRate) : null,
    vatAmount: invoice.vatAmount != null ? String(invoice.vatAmount) : '0',
    discountAmount:
      invoice.discountAmount != null ? String(invoice.discountAmount) : '0',
    totalAmount:
      invoice.totalAmount != null ? String(invoice.totalAmount) : '0',
    items: invoice.items
      ? invoice.items.map((i) => ({
          ...i,
          quantity: i.quantity != null ? String(i.quantity) : null,
          unitPrice: i.unitPrice != null ? String(i.unitPrice) : null,
          preVatAmount: i.preVatAmount != null ? String(i.preVatAmount) : '0',
          vatRate: i.vatRate != null ? String(i.vatRate) : null,
          vatAmount: i.vatAmount != null ? String(i.vatAmount) : '0',
          discountAmount:
            i.discountAmount != null ? String(i.discountAmount) : '0',
          totalAmount: i.totalAmount != null ? String(i.totalAmount) : '0',
        }))
      : undefined,
    voucherNetOffs: invoice.voucherNetOffs,
    attachments: invoice.attachments,
    category: invoice.category || null,
    categoryId: invoice.categoryId || null,
    attributes: (invoice as any).attributes || {},
    globalAttributes: (invoice as any).globalAttributes || {},
    customAttributes:
      (invoice as any).customAttributes || (invoice as any).attributes || {},
    attributeValues: (invoice as any).attributeValues || [],
  };
}
