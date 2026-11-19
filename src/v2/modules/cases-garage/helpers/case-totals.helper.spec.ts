import { computeCaseTotals, computeLineAmounts } from './case-totals.helper';

describe('case totals', () => {
  it('dòng có số lượng và đơn giá: trừ chiết khấu, cộng phụ phí, tính thuế', () => {
    const r = computeLineAmounts({
      quantity: 2,
      unitPrice: 100,
      lineDiscountAmount: 20,
      surchargeAmount: 10,
      taxRate: 10,
      productTypeCode: 'PT',
    });
    expect(r.amountBeforeTax).toBe('190.00');
    expect(r.amountWithTax).toBe('209.00');
    expect(r.partsAmount).toBe('190.00');
    expect(r.serviceAmount).toBe('0.00');
  });

  it('không có đơn giá: lấy từ serviceAmount + partsAmount', () => {
    const r = computeLineAmounts({ serviceAmount: 300, taxRate: 8 });
    expect(r.amountBeforeTax).toBe('300.00');
    expect(r.amountWithTax).toBe('324.00');
  });

  it('tổng header bỏ dòng đã xóa phía KGara và tính lợi nhuận', () => {
    const t = computeCaseTotals(
      [
        { amountBeforeTax: '100', amountWithTax: '110', partsCost: '30' },
        { amountBeforeTax: '50', amountWithTax: '55', partsCost: null },
        {
          amountBeforeTax: '999',
          amountWithTax: '999',
          externalDeletedAt: new Date(),
        },
      ],
      40,
    );
    expect(t).toEqual({
      totalAmountWithTax: '165.00',
      revenue: '150.00',
      cost: '30.00',
      profit: '120.00',
      outstandingAmount: '125.00',
    });
  });
});
