import {
  calculateArDocumentSettlement,
  filterEligibleCashBankSettlementLinks,
  normalizeCashBankAmount,
  validateCashBankRelatedArDocuments,
} from './cash-bank-settlement.util';

describe('cash-bank settlement utilities', () => {
  it('keeps invoice partially open when linked amount is lower than total', () => {
    expect(calculateArDocumentSettlement(25_000_000, [15_000_000])).toEqual({
      settledAmount: 15_000_000,
      openAmount: 10_000_000,
      status: 'PARTIAL',
    });
  });

  it('keeps Vietnamese thousand-separated amounts in VND units', () => {
    expect(normalizeCashBankAmount('15.000.000')).toBe(15_000_000);
    expect(calculateArDocumentSettlement('25.000.000', ['15.000.000'])).toEqual({
      settledAmount: 15_000_000,
      openAmount: 10_000_000,
      status: 'PARTIAL',
    });
  });

  it('rejects related AR allocation totals greater than voucher amount', () => {
    expect(() =>
      validateCashBankRelatedArDocuments({
        voucherAmount: 15_000_000,
        relatedDocuments: [
          { related_type: 'ar_documents', related_id: 'doc-1', amount: 25_000_000 },
        ],
      }),
    ).toThrow('Tổng số tiền cấn trừ công nợ không được vượt quá số tiền phiếu');
  });

  it('only includes approved or posted voucher links in AR settlement', () => {
    expect(
      filterEligibleCashBankSettlementLinks([
        { amount: 15_000_000, payment_voucher_id: { status: 'DRAFT' } },
        { amount: 4_000_000, payment_voucher_id: { status: 'PENDING_APPROVAL' } },
        { amount: 6_000_000, payment_voucher_id: { status: 'APPROVED' } },
        { amount: 9_000_000, payment_voucher_id: { status: 'POSTED' } },
        { amount: 7_000_000, payment_voucher_id: { status: 'CANCELLED' } },
      ]).map((item) => item.amount),
    ).toEqual([6_000_000, 9_000_000]);
  });

  it('reopens invoice when all eligible voucher links are removed', () => {
    expect(calculateArDocumentSettlement(25_000_000, [])).toEqual({
      settledAmount: 0,
      openAmount: 25_000_000,
      status: 'POSTED',
    });
  });
});
