import {
  FINANCIAL_GROUP_CATEGORIES,
  isFinancialCategory,
  applyOpexListFilters,
} from './garage-opex-query.builder';

describe('garage-opex-query.builder', () => {
  describe('isFinancialCategory', () => {
    it('returns true for predefined financial keys', () => {
      expect(isFinancialCategory('LAI_VAY')).toBe(true);
      expect(isFinancialCategory('CHI_PHI_TAI_CHINH')).toBe(true);
      expect(isFinancialCategory('CHI_PHI_TAI_CHINH_KHAC')).toBe(true);
      expect(isFinancialCategory('PHI_TAI_CHINH')).toBe(true);
    });

    it('returns true for keys containing TAI_CHINH or LAI_VAY', () => {
      expect(isFinancialCategory('TAI_CHINH_NGAN_HANG')).toBe(true);
      expect(isFinancialCategory('CHI_PHI_LAI_VAY_THANG')).toBe(true);
    });

    it('returns false for non-financial keys', () => {
      expect(isFinancialCategory('NHAN_SU')).toBe(false);
      expect(isFinancialCategory('THUE_MAT_BANG')).toBe(false);
      expect(isFinancialCategory('HOA_HONG_TRUC_TIEP')).toBe(false);
      expect(isFinancialCategory('HHBH')).toBe(false);
      expect(isFinancialCategory(null)).toBe(false);
      expect(isFinancialCategory(undefined)).toBe(false);
    });
  });

  describe('applyOpexListFilters for cost_group', () => {
    let mockQb: any;

    beforeEach(() => {
      mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
    });

    it('filters by FINANCIAL group correctly', () => {
      applyOpexListFilters(mockQb, { cost_group: 'FINANCIAL' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('opex.category_key IN (:...fin)'),
        expect.objectContaining({
          fin: FINANCIAL_GROUP_CATEGORIES,
        }),
      );
    });

    it('excludes FINANCIAL from OPEX group', () => {
      applyOpexListFilters(mockQb, { cost_group: 'OPEX' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('opex.category_key NOT IN (:...cogsCommFin)'),
        expect.objectContaining({
          finPattern: '%TAI_CHINH%',
        }),
      );
    });
  });
});
