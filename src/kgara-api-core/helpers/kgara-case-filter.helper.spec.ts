import { Brackets } from 'typeorm';
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
    it('should map standard case columns to SQL expressions with so_chung_tu as single source of truth', () => {
      // Fix triệt để: caseCode trỏ trực tiếp về "case"."so_chung_tu", không ghép chuỗi lỏng lẻo
      expect(getCaseColumnSelectExpr('caseCode')).toBe('"case"."so_chung_tu"');
      expect(getCaseColumnSelectExpr('soChungTu')).toBe('"case"."so_chung_tu"');
      expect(getCaseColumnSelectExpr('licensePlate')).toBe(
        '"case"."bien_so_xe"',
      );
      expect(getCaseColumnSelectExpr('totalAmount')).toBe(
        '"case"."tien_co_thue"',
      );
      expect(getCaseColumnSelectExpr('doanhThu')).toBe(
        'COALESCE("case"."doanh_thu", "gp"."doanh_thu")',
      );
      expect(getCaseColumnSelectExpr('chiPhi')).toBe(
        'COALESCE("case"."chi_phi", "gp"."chi_phi")',
      );
      expect(getCaseColumnSelectExpr('doanhThu')).not.toContain('tien_co_thue');
      expect(getCaseColumnSelectExpr('loiNhuan')).not.toContain('tien_co_thue');
      expect(getCaseColumnSelectExpr('margin')).not.toContain('tien_co_thue');
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

    it('should handle caseCode with __ALL_MATCHING__ across both so_chung_tu and bien_so_xe', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(
        qb,
        'caseCode',
        ['__ALL_MATCHING__', 'PDV-001;51F-123.45'],
        'test_case_code',
      );
      expect(qb.andWhere).toHaveBeenCalled();
      const bracketArg = qb.andWhere.mock.calls[0][0];
      expect(bracketArg).toBeInstanceOf(Brackets);
    });

    it('should handle caseCode with exact quote search', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(
        qb,
        'caseCode',
        ['"PDV-202607-001"'],
        'test_exact',
      );
      expect(qb.andWhere).toHaveBeenCalled();
      const bracketArg = qb.andWhere.mock.calls[0][0];
      expect(bracketArg).toBeInstanceOf(Brackets);

      // Verify inner query builder call inside bracket
      const sqb: any = { where: jest.fn(), orWhere: jest.fn() };
      bracketArg.whereFactory(sqb);
      expect(sqb.where).toHaveBeenCalledWith(
        expect.stringContaining(
          '"case"."so_chung_tu" ILIKE :test_exact_exact_0',
        ),
        { test_exact_exact_0: 'PDV-202607-001' },
      );
    });

    it('should handle caseCode with semicolon multi-keyword', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(
        qb,
        'caseCode',
        ['PDV-001;PDV-002'],
        'test_multi',
      );
      expect(qb.andWhere).toHaveBeenCalled();
      const bracketArg = qb.andWhere.mock.calls[0][0];
      expect(bracketArg).toBeInstanceOf(Brackets);
    });

    it('should handle caseCode with plain license plate and composite value', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(
        qb,
        'caseCode',
        ['51F-123.45', 'PDV-001:::51G-999.99'],
        'test_plate_in',
      );
      expect(qb.andWhere).toHaveBeenCalled();
      const bracketArg = qb.andWhere.mock.calls[0][0];
      expect(bracketArg).toBeInstanceOf(Brackets);

      const sqb: any = { where: jest.fn(), orWhere: jest.fn() };
      bracketArg.whereFactory(sqb);
      expect(sqb.where).toHaveBeenCalledWith(
        expect.stringContaining(
          '"case"."so_chung_tu" IN (:...test_plate_in_in_vals)',
        ),
        {
          test_plate_in_in_vals: ['51F-123.45', 'PDV-001', '51G-999.99'],
        },
      );
    });

    it('should handle caseCode with __BLANK__', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(qb, 'caseCode', ['__BLANK__'], 'test_blank');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '("case"."so_chung_tu" IS NULL OR "case"."so_chung_tu" = \'\')',
      );
    });

    it('should handle customer with __ALL_MATCHING__ multi-field search', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(
        qb,
        'customer',
        ['__ALL_MATCHING__', 'Công ty ABC'],
        'test_customer',
      );
      expect(qb.andWhere).toHaveBeenCalled();
      const bracketArg = qb.andWhere.mock.calls[0][0];
      expect(bracketArg).toBeInstanceOf(Brackets);
    });

    it('should handle generic text column with exact and plain values', () => {
      const qb: any = { andWhere: jest.fn().mockReturnThis() };
      applySingleCaseColumnFilter(
        qb,
        'licensePlate',
        ['"51F-123.45"', '51G-999.99'],
        'test_plate',
      );
      expect(qb.andWhere).toHaveBeenCalled();
      const bracketArg = qb.andWhere.mock.calls[0][0];
      expect(bracketArg).toBeInstanceOf(Brackets);

      const sqb: any = { where: jest.fn(), orWhere: jest.fn() };
      bracketArg.whereFactory(sqb);
      expect(sqb.where).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE :test_plate_txt_exact_0'),
        { test_plate_txt_exact_0: '51F-123.45' },
      );
      expect(sqb.orWhere).toHaveBeenCalledWith(
        expect.stringContaining('IN (:...test_plate_txt_in)'),
        { test_plate_txt_in: ['51G-999.99'] },
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
