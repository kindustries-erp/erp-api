import {
  calculateArDocumentSettlement,
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
});
