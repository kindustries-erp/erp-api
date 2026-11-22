import {
  hasReceiptSettlement,
  computeCaseRemaining,
} from './kgara-case-remaining.helper';

describe('computeCaseRemaining', () => {
  it('chiết khấu đã thu đủ phần ròng thì còn phải thu = 0 (dù cột lưu sẵn còn số chiết khấu)', () => {
    const r = computeCaseRemaining({
      netRevenue: 65165402,
      storedPaid: 65165402,
      hasReceipt: false,
      receipts: 0,
      excludeFromDebt: false,
    });
    expect(r).toEqual({ paid: 65165402, remaining: 0 });
  });

  it('chưa thu đủ phần ròng thì chỉ còn phần ròng chưa thu', () => {
    const r = computeCaseRemaining({
      netRevenue: 5309550,
      storedPaid: 4769550,
      hasReceipt: true,
      receipts: 4769550,
      excludeFromDebt: false,
    });
    expect(r).toEqual({ paid: 4769550, remaining: 540000 });
  });

  it('có settlement thì ưu tiên tổng RECEIPT thay cho cột đã lưu', () => {
    const r = computeCaseRemaining({
      netRevenue: 1000000,
      storedPaid: 0,
      hasReceipt: true,
      receipts: 400000,
      excludeFromDebt: false,
    });
    expect(r).toEqual({ paid: 400000, remaining: 600000 });
  });

  it('thu dư không làm còn phải thu âm', () => {
    const r = computeCaseRemaining({
      netRevenue: 1000000,
      storedPaid: 0,
      hasReceipt: true,
      receipts: 1200000,
      excludeFromDebt: false,
    });
    expect(r).toEqual({ paid: 1200000, remaining: 0 });
  });

  it('phiếu loại trừ công nợ luôn cho 0', () => {
    const r = computeCaseRemaining({
      netRevenue: 2000000,
      storedPaid: 0,
      hasReceipt: false,
      receipts: 0,
      excludeFromDebt: true,
    });
    expect(r).toEqual({ paid: 0, remaining: 0 });
  });

  it('làm tròn 2 chữ số và chịu được giá trị chuỗi/null', () => {
    const r = computeCaseRemaining({
      netRevenue: '100.555',
      storedPaid: null,
      hasReceipt: false,
      receipts: null,
      excludeFromDebt: null,
    });
    expect(r.remaining).toBe(100.56);
    expect(r.paid).toBe(0);
  });
});

describe('hasReceiptSettlement', () => {
  it('không settlement -> false', () => {
    expect(hasReceiptSettlement([])).toBe(false);
    expect(hasReceiptSettlement(undefined)).toBe(false);
  });
  it('chỉ PAYMENT -> false', () => {
    expect(hasReceiptSettlement([{ settlementType: 'PAYMENT' }])).toBe(false);
  });
  it('có RECEIPT -> true', () => {
    expect(
      hasReceiptSettlement([
        { settlementType: 'PAYMENT' },
        { settlementType: 'RECEIPT' },
      ]),
    ).toBe(true);
  });
});
