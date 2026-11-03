/**
 * Khóa đối tác dựa trên hóa đơn, dùng chung cho công nợ, đồng bộ đối tác và sao kê.
 *
 * Quy ước: có MST (hoặc CCCD bên mua) thì khóa là MST; không có thì khóa là tên.
 * Biểu thức SQL bên dưới phải giữ đúng với các biểu thức đang gom công nợ,
 * nếu đổi ở đây thì số liệu công nợ đổi theo.
 */

export type InvoicePartnerDirection = 'IN' | 'OUT';

export const KHONG_MST = 'KHONG_MST';
export const DEFAULT_SUPPLIER_NAME = 'Nhà cung cấp';
export const DEFAULT_CUSTOMER_NAME = 'Khách hàng lẻ';

export interface InvoicePartnerSqlParts {
  taxCodeExpr: string;
  nameExpr: string;
}

/** Chuẩn hóa MST/CCCD: bỏ khoảng trắng hai đầu, rỗng thì coi như không có. */
export const normalizeTaxCode = (
  raw: string | null | undefined,
): string | null => {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

/** Khóa đối tác phía TypeScript: MST nếu có, không có thì tên. */
export const resolvePartnerKey = (input: {
  taxCode?: string | null;
  name?: string | null;
}): { kind: 'TAX' | 'NAME'; value: string } | null => {
  const taxCode = normalizeTaxCode(input.taxCode);
  if (taxCode) return { kind: 'TAX', value: taxCode };
  const name = (input.name ?? '').trim();
  return name === '' ? null : { kind: 'NAME', value: name };
};

/**
 * Biểu thức SQL lấy MST và tên đối tác từ bảng `erp_invoices` (alias `inv`).
 * Bên bán (IN) lấy từ seller_*; bên mua (OUT) ưu tiên giá trị đã sửa trong effective_data.
 */
export const buildInvoicePartnerSqlParts = (
  direction: InvoicePartnerDirection,
): InvoicePartnerSqlParts => {
  if (direction === 'IN') {
    return {
      taxCodeExpr: `COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), '${KHONG_MST}')`,
      nameExpr: `COALESCE(NULLIF(TRIM(inv.seller_name), ''), '${DEFAULT_SUPPLIER_NAME}')`,
    };
  }
  return {
    taxCodeExpr: `COALESCE(NULLIF(TRIM(inv.effective_data->'effectiveValues'->>'buyerTaxCode'), ''), NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), '${KHONG_MST}')`,
    nameExpr: `COALESCE(NULLIF(TRIM(inv.effective_data->'effectiveValues'->>'buyerName'), ''), NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), '${DEFAULT_CUSTOMER_NAME}')`,
  };
};
