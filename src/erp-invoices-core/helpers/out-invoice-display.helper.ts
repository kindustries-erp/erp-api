export const DAO_TRI_OUT_TAX_CODES = new Set([
  '0110269067-001',
  '0110269067',
  '0202357718',
  '0108926276',
]);

export const DAO_TRI_IN_TAX_CODES = new Set(['0202357718']);

export const DAO_TRI_SETTLEMENT_PREFIXES = new Set([
  'S52801',
  'S52802',
  'S64701',
]);

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

export function isDaoTriInInvoiceTaxCode(
  taxCode: string | null | undefined,
): boolean {
  return DAO_TRI_IN_TAX_CODES.has(normalizeText(taxCode));
}

export function resolveInInvoiceBranchCode(
  sellerTaxCode?: string | null,
  buyerTaxCode?: string | null,
): 'ĐT' | null {
  if (
    isDaoTriInInvoiceTaxCode(sellerTaxCode) ||
    isDaoTriInInvoiceTaxCode(buyerTaxCode)
  ) {
    return 'ĐT';
  }
  return null;
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

export interface InvoiceLineClassification {
  invoiceSubcategory: 'NORMAL' | 'DISCOUNT' | 'RESCUE';
  quantity: number;
  unitPrice: number;
  preVatAmount: number;
  vatAmount: number;
  totalAmount: number;
  discountAmount: number;
}

export function classifyInvoiceLine(
  item: OutInvoiceLineDisplayInput,
  opts: {
    buyerTaxCode?: string | null;
    direction?: string | null;
    invoiceLineCount?: number;
    taxInvoiceStatus?: number | null;
    headerDiscountAmount?: number;
    forReportExport?: boolean;
  } = {},
): InvoiceLineClassification {
  const {
    buyerTaxCode,
    direction,
    invoiceLineCount = 1,
    taxInvoiceStatus,
    headerDiscountAmount = 0,
    forReportExport = false,
  } = opts;

  const description = normalizeText(item.description || item.unitName || '');
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

  // Note: rescue keyword applies to both IN and OUT
  const isRescue = hasRescueKeyword(description);

  const headerHasDiscount = headerDiscountAmount > 0;

  // Strict matching amount: abs(unitPrice) == headerDiscountAmount or abs(preVat) == headerDiscountAmount
  const amountMatchesHeader =
    Math.round(Math.abs(unitPrice)) === Math.round(headerDiscountAmount) ||
    Math.round(Math.abs(preVatAmount)) === Math.round(headerDiscountAmount);

  const hasDiscountToken = hasDiscountKeyword(description);
  const isDiscountCandidate =
    forReportExport &&
    hasDiscountToken &&
    invoiceLineCount > 1 &&
    headerHasDiscount &&
    amountMatchesHeader;

  let invoiceSubcategory: 'NORMAL' | 'DISCOUNT' | 'RESCUE' = 'NORMAL';
  if (isRescue) {
    invoiceSubcategory = 'RESCUE';
  } else if (isDiscountCandidate) {
    invoiceSubcategory = 'DISCOUNT';
  }

  // STRICT negative rule requires ALL conditions
  // (Removed taxInvoiceStatus === 1 as requested)
  // ONLY apply when exporting report
  const shouldApplyNegativeAmount =
    forReportExport &&
    invoiceSubcategory === 'DISCOUNT' &&
    headerHasDiscount &&
    amountMatchesHeader;

  const displayQuantity = shouldApplyNegativeAmount ? 1 : quantity;
  const displayUnitPrice = shouldApplyNegativeAmount
    ? Math.abs(preVatAmount || discountAmount || totalAmount || 0)
    : unitPrice;
  const displayPreVatAmount = shouldApplyNegativeAmount
    ? -(preVatAmount || discountAmount || totalAmount || 0)
    : preVatAmount;
  const displayVatAmount = shouldApplyNegativeAmount
    ? -(vatAmount || 0)
    : vatAmount;
  const displayTotalAmount = shouldApplyNegativeAmount
    ? -(totalAmount || preVatAmount || discountAmount || 0)
    : totalAmount;
  const displayDiscountAmount = shouldApplyNegativeAmount
    ? -(discountAmount || preVatAmount || totalAmount || 0)
    : discountAmount;

  return {
    invoiceSubcategory,
    quantity: displayQuantity,
    unitPrice: displayUnitPrice,
    preVatAmount: displayPreVatAmount,
    vatAmount: displayVatAmount,
    totalAmount: displayTotalAmount,
    discountAmount: displayDiscountAmount,
  };
}
