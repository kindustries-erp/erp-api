import {
  getGarageCashflowColumnSelectExpr,
  applyGarageCashflowStatusTab,
  applyGarageCashflowFilters,
  applyGarageCashflowSorts,
} from './garage-cashflow-filter.helper';

describe('garage-cashflow-filter.helper', () => {
  let mockQb: any;

  beforeEach(() => {
    mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      clone: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
  });

  describe('getGarageCashflowColumnSelectExpr', () => {
    it('returns SQL expression for known columns', () => {
      expect(getGarageCashflowColumnSelectExpr('settlementType')).toBe(
        's.settlementType',
      );
      expect(getGarageCashflowColumnSelectExpr('amount')).toBe('s.amount');
      expect(getGarageCashflowColumnSelectExpr('soChungTu')).toBe(
        'c.soChungTu',
      );
      expect(getGarageCashflowColumnSelectExpr('unknown')).toBeNull();
    });
  });

  describe('applyGarageCashflowStatusTab', () => {
    it('applies filter for receipt tab', () => {
      applyGarageCashflowStatusTab(mockQb, 'receipt');
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        's.settlementType = :stTab',
        {
          stTab: 'RECEIPT',
        },
      );
    });

    it('applies filter for payment tab', () => {
      applyGarageCashflowStatusTab(mockQb, 'payment');
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        's.settlementType = :stTab',
        {
          stTab: 'PAYMENT',
        },
      );
    });

    it('applies filter for with_bank tab', () => {
      applyGarageCashflowStatusTab(mockQb, 'with_bank');
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        's.bankTransactionId IS NOT NULL',
      );
    });

    it('applies filter for no_bank tab', () => {
      applyGarageCashflowStatusTab(mockQb, 'no_bank');
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        's.bankTransactionId IS NULL',
      );
    });

    it('ignores all or undefined tab', () => {
      applyGarageCashflowStatusTab(mockQb, 'all');
      applyGarageCashflowStatusTab(mockQb, undefined);
      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('applyGarageCashflowFilters', () => {
    it('handles empty or malformed JSON gracefully', () => {
      expect(() =>
        applyGarageCashflowFilters(mockQb, '{invalid-json'),
      ).not.toThrow();
      expect(() => applyGarageCashflowFilters(mockQb, undefined)).not.toThrow();
    });

    it('applies dateRange filter from object', () => {
      const filters = JSON.stringify({
        transDate: { type: 'dateRange', from: '2026-03-01', to: '2026-03-31' },
      });
      applyGarageCashflowFilters(mockQb, filters);
      expect(mockQb.andWhere).toHaveBeenCalledWith('s.transDate >= :fromDate', {
        fromDate: '2026-03-01',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('s.transDate <= :toDate', {
        toDate: '2026-03-31',
      });
    });

    it('applies amountRange filter from object', () => {
      const filters = JSON.stringify({
        amount: { type: 'amountRange', min: 100000, max: 5000000 },
      });
      applyGarageCashflowFilters(mockQb, filters);
      expect(mockQb.andWhere).toHaveBeenCalledWith('s.amount >= :minAmount', {
        minAmount: 100000,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('s.amount <= :maxAmount', {
        maxAmount: 5000000,
      });
    });

    it('applies options filter array', () => {
      const filters = JSON.stringify({
        settlementType: ['RECEIPT', 'PAYMENT'],
      });
      applyGarageCashflowFilters(mockQb, filters);
      expect(mockQb.andWhere).toHaveBeenCalled();
    });
  });

  describe('applyGarageCashflowSorts', () => {
    it('applies single sort descending with minus prefix', () => {
      applyGarageCashflowSorts(mockQb, '-amount');
      expect(mockQb.orderBy).toHaveBeenCalledWith('s.amount', 'DESC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('s.createdAt', 'DESC');
    });

    it('applies multi sorts array', () => {
      applyGarageCashflowSorts(mockQb, ['transDate', '-amount']);
      expect(mockQb.orderBy).toHaveBeenCalledWith('s.transDate', 'ASC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('s.amount', 'DESC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('s.createdAt', 'DESC');
    });

    it('falls back to transDate DESC if no sort given', () => {
      applyGarageCashflowSorts(mockQb);
      expect(mockQb.orderBy).toHaveBeenCalledWith('s.transDate', 'DESC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('s.createdAt', 'DESC');
    });
  });
});
