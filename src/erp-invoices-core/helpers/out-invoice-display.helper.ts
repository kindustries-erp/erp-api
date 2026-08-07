const DAO_TRI_OUT_TAX_CODES = new Set([
  '0110269067-001',
  '0110269067',
  '0202357718',
  '0108926276',
]);

const DAO_TRI_SETTLEMENT_PREFIXES = new Set(['S52801', 'S52802', 'S64701']);

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim();
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasRescueKeyword(text: string): boolean {
  return /cứu\s*hộ/i.test(text);
}

function hasDiscountKeyword(text: string): boolean {
  return /(chiết\s*khấu|giảm\s*trừ|khấu\s*trừ)/i.test(text);
}

export function isDaoTriOutInvoiceTaxCode(
  taxCode: string | null | undefined,
): boolean {
  return DAO_TRI_OUT_TAX_CODES.has(normalizeText(taxCode));
}

export function resolveOutInvoiceBranchCode(
  settlementOrder: string | null | undefined,
  buyerTaxCode?: string | null,
): 'ĐT' | 'PQ' {
  if (isDaoTriOutInvoiceTaxCode(buyerTaxCode)) {
    return 'ĐT';
  }

  if (settlementOrder) {
    const prefixMatch = settlementOrder.match(/^([^-]+)-WO-/i);
    if (prefixMatch && DAO_TRI_SETTLEMENT_PREFIXES.has(prefixMatch[1])) {
      return 'ĐT';
    }
  }

  return 'PQ';
}

export interface OutInvoiceLineDisplayInput {
  description?: string | null;
  unit?: string | null;
  unitName?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  preVatAmount?: number | string | null;
  vatAmount?: number | string | null;
  totalAmount?: number | string | null;
  discountAmount?: number | string | null;
  itemTotalAmountWithoutVat?: number | string | null;
  itemTotalAmountWithVat?: number | string | null;
}

export interface OutInvoiceLineDisplayResult {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  preVatAmount: number;
  vatAmount: number;
  totalAmount: number;
  discountAmount: number;
}

export function normalizeOutInvoiceLineDisplay(
  item: OutInvoiceLineDisplayInput,
  buyerTaxCode?: string | null,
  direction?: string | null,
  invoiceLineCount: number = 1,
): OutInvoiceLineDisplayResult {
  const description = normalizeText(item.description || item.unitName || '');
  const baseUnit = normalizeText(item.unit || item.unitName || '');
  const quantity = toNumber(item.quantity);
  const unitPrice = toNumber(item.unitPrice);
  const discountAmount = toNumber(item.discountAmount);
  const preVatAmount = toNumber(
    item.preVatAmount ?? item.itemTotalAmountWithoutVat,
  );
  const vatAmount = toNumber(item.vatAmount);
  const totalAmount = toNumber(item.totalAmount ?? item.itemTotalAmountWithVat);

  const shouldApplyOutRule = direction !== 'IN';
  const isDaoTri =
    shouldApplyOutRule && isDaoTriOutInvoiceTaxCode(buyerTaxCode);
  const isRescue = hasRescueKeyword(description);
  const hasDiscountToken = hasDiscountKeyword(description);
  const isDiscountLine = isDaoTri && hasDiscountToken && invoiceLineCount > 1;

  let unit = baseUnit;
  if (isRescue) {
    unit = 'Cứu hộ';
  } else if (isDiscountLine) {
    unit = 'Chiết khấu';
  }

  const displayQuantity = isDiscountLine ? 1 : quantity;
  const displayUnitPrice = isDiscountLine
    ? Math.abs(preVatAmount || discountAmount || totalAmount)
    : unitPrice;
  const displayPreVatAmount = isDiscountLine
    ? -Math.abs(preVatAmount || discountAmount || totalAmount)
    : preVatAmount;
  const displayVatAmount = isDiscountLine ? -Math.abs(vatAmount) : vatAmount;
  const displayTotalAmount = isDiscountLine
    ? -Math.abs(totalAmount || preVatAmount || discountAmount)
    : totalAmount;
  const displayDiscountAmount = isDiscountLine
    ? -Math.abs(discountAmount || preVatAmount || totalAmount)
    : discountAmount;

  return {
    description,
    unit,
    quantity: displayQuantity,
    unitPrice: displayUnitPrice,
    preVatAmount: displayPreVatAmount,
    vatAmount: displayVatAmount,
    totalAmount: displayTotalAmount,
    discountAmount: displayDiscountAmount,
  };
}
