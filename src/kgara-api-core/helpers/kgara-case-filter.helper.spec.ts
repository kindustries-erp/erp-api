import {
  getCaseColumnSelectExpr,
  getCaseServiceColumnSelectExpr,
  applySingleCaseColumnFilter,
  applyCaseOptionFilters,
  applyCaseListFilters,
  applySingleCaseServiceColumnFilter,
  applyCaseServiceFilters,
} from './kgara-case-filter.helper';

describe('kgara-case-filter.helper', () => {
  describe('getCaseColumnSelectExpr', () => {
    it('should map standard case columns to SQL expressions', () => {
      expect(getCaseColumnSelectExpr('caseCode')).toBe('"case"."so_chung_tu"');
      expect(getCaseColumnSelectExpr('licensePlate')).toBe(
        '"case"."bien_so_xe"',
      );
      expect(getCaseColumnSelectExpr('totalAmount')).toBe(
        '"case"."tien_co_thue"',
      );
      expect(getCaseColumnSelectExpr('invalidColumn')).toBeNull();
    });
  });

  describe('getCaseServiceColumnSelectExpr', () => {
    it('should map service columns to SQL expressions', () => {
      expect(getCaseServiceColumnSelectExpr('sanPhamCode')).toBe(
        '"srv"."san_pham_code"',
      );
      expect(getCaseServiceColumnSelectExpr('donGia')).toBe('"srv"."don_gia"');
      expect(getCaseServiceColumnSelectExpr('tienCoThue')).toBe(
        '"srv"."tien_co_thue"',
      );
      expect(getCaseServiceColumnSelectExpr('nonExistent')).toBeNull();
    });
  });

  describe('applySingleCaseColumnFilter', () => {
    it('should handle date range filters', () => {
      const qb: any = { andWhere: jest.fn() };
      applySingleCaseColumnFilter(
        qb,
        'caseDate',
        ['2026-01-01..2026-01-31'],
        'test',
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should handle collectionProgress filter', () => {
      const qb: any = { andWhere: jest.fn() };
      applySingleCaseColumnFilter(
        qb,
        'collectionProgress',
        ['PAID', 'UNPAID'],
        'test',
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('tienConPhaiThanhToan'),
      );
    });

    it('should handle vatInvoice filter', () => {
      const qb: any = { andWhere: jest.fn() };
      applySingleCaseColumnFilter(qb, 'vatInvoice', ['YES'], 'test');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('DaTaoHoaDonThue'),
      );
    });
  });

  describe('applyCaseOptionFilters and applyCaseListFilters', () => {
    it('should safely parse JSON filters', () => {
      const qb: any = { andWhere: jest.fn() };
      const filters = JSON.stringify({ classification: ['SUA_CHUA_CHUNG'] });
      applyCaseListFilters(qb, filters);
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should ignore invalid JSON gracefully', () => {
      const qb: any = { andWhere: jest.fn() };
      expect(() => applyCaseListFilters(qb, '{invalid-json')).not.toThrow();
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('applyCaseServiceFilters', () => {
    it('should apply service filters', () => {
      const qb: any = { andWhere: jest.fn() };
      const filters = JSON.stringify({ serviceType: ['PT'] });
      applyCaseServiceFilters(qb, filters);
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });
});
