import { AiJsonParseError, toAiNumber, toAiText } from '@/v2/core/ai-hub-core';
import {
  GarageItemType,
  normalizeItemCode,
  toGarageItemType,
} from '@/v2/modules/items-garage/helpers/garage-item-code.helper';

export interface GarageInvoiceHeader {
  sellerName: string | null;
  sellerTaxCode: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  total: number | null;
}

export interface GarageInvoiceLine {
  itemName: string;
  itemCode: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number | null;
  itemType: GarageItemType;
}

export interface GarageInvoiceExtraction {
  invoice: GarageInvoiceHeader;
  lines: GarageInvoiceLine[];
  /** Số dòng model trả về nhưng bị loại vì thiếu tên hoặc số lượng không hợp lệ. */
  skippedLines: number;
}

const MAX_LINES = 200;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const textOrNull = (value: unknown, max = 255) => toAiText(value, max) || null;
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Chuẩn hóa JSON thô của model. Ném `AiJsonParseError` khi không có dòng hàng hợp lệ nào. */
export function normalizeGarageInvoice(
  raw: Record<string, unknown>,
): GarageInvoiceExtraction {
  const header = asRecord(raw.invoice);
  const rawLines = Array.isArray(raw.lines)
    ? raw.lines.slice(0, MAX_LINES)
    : [];
  const lines: GarageInvoiceLine[] = [];
  for (const entry of rawLines) {
    const line = asRecord(entry);
    const itemName = toAiText(line.itemName);
    const quantity = toAiNumber(line.quantity);
    if (!itemName || quantity === null || quantity <= 0) continue;
    const unitPrice = toAiNumber(line.unitPrice);
    lines.push({
      itemName,
      itemCode: normalizeItemCode(toAiText(line.itemCode, 128)) || null,
      unit: textOrNull(line.unit, 50),
      quantity: round3(quantity),
      unitPrice:
        unitPrice !== null && unitPrice >= 0 ? round3(unitPrice) : null,
      itemType: toGarageItemType(line.itemType),
    });
  }
  if (!lines.length) {
    throw new AiJsonParseError('không tìm thấy dòng hàng nào trên tài liệu');
  }

  const invoiceDate = toAiText(header.invoiceDate, 10);
  return {
    invoice: {
      sellerName: textOrNull(header.sellerName),
      sellerTaxCode: textOrNull(header.sellerTaxCode, 20),
      invoiceNo: textOrNull(header.invoiceNo, 64),
      invoiceDate: ISO_DATE.test(invoiceDate) ? invoiceDate : null,
      total: toAiNumber(header.total),
    },
    lines,
    skippedLines: rawLines.length - lines.length,
  };
}

/** Dòng dịch vụ đi vào PR với loại SERVICE, còn lại là GOODS. */
export function lineTypeOf(itemType: string | null | undefined) {
  return itemType === 'DV' ? ('SERVICE' as const) : ('GOODS' as const);
}

/** Tổng tiền các dòng (số lượng x đơn giá), bỏ qua dòng thiếu đơn giá. */
export function sumLineAmounts(
  lines: Pick<GarageInvoiceLine, 'quantity' | 'unitPrice'>[],
): number {
  return round3(
    lines.reduce((sum, l) => sum + l.quantity * (l.unitPrice ?? 0), 0),
  );
}
