import {
  buildInvoicePartnerSqlParts,
  normalizeTaxCode,
  resolvePartnerKey,
} from './invoice-partner-key.util';

describe('invoice-partner-key.util', () => {
  describe('normalizeTaxCode', () => {
    it('trims and treats blank values as missing', () => {
      expect(normalizeTaxCode('  0318334886-003 ')).toBe('0318334886-003');
      expect(normalizeTaxCode('   ')).toBeNull();
      expect(normalizeTaxCode('')).toBeNull();
      expect(normalizeTaxCode(null)).toBeNull();
      expect(normalizeTaxCode(undefined)).toBeNull();
    });
  });

  describe('resolvePartnerKey', () => {
    it('prefers the tax code and falls back to the name', () => {
      expect(resolvePartnerKey({ taxCode: ' 0100 ', name: 'ABC' })).toEqual({
        kind: 'TAX',
        value: '0100',
      });
      expect(resolvePartnerKey({ taxCode: '', name: ' ABC ' })).toEqual({
        kind: 'NAME',
        value: 'ABC',
      });
    });

    it('returns null when neither tax code nor name is present', () => {
      expect(resolvePartnerKey({ taxCode: null, name: '  ' })).toBeNull();
    });
  });

  describe('buildInvoicePartnerSqlParts', () => {
    it('reads the seller side for purchase invoices (IN)', () => {
      const parts = buildInvoicePartnerSqlParts('IN');
      expect(parts.taxCodeExpr).toContain('inv.seller_tax_code');
      expect(parts.taxCodeExpr).toContain("'KHONG_MST'");
      expect(parts.nameExpr).toContain('inv.seller_name');
      expect(parts.nameExpr).toContain("'Nhà cung cấp'");
    });

    it('reads the buyer side with effective overrides for sales invoices (OUT)', () => {
      const parts = buildInvoicePartnerSqlParts('OUT');
      expect(parts.taxCodeExpr).toContain("effectiveValues'->>'buyerTaxCode'");
      expect(parts.taxCodeExpr).toContain('inv.buyer_cccd');
      expect(parts.nameExpr).toContain("effectiveValues'->>'buyerName'");
      expect(parts.nameExpr).toContain("'Khách hàng lẻ'");
    });
  });
});
