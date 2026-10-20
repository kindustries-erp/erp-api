import { buildInvoiceJournalLines } from './invoice-journal-lines.helper';

describe('buildInvoiceJournalLines', () => {
  const base = {
    debitAccountId: 'd',
    vatAccountId: 'v',
    apAccountId: 'a',
    invoiceRef: '1-A',
    defaultDesc: 'Mua hàng',
  };
  const pick = (lines: ReturnType<typeof buildInvoiceJournalLines>) =>
    lines.map((l) => [l.accountId, l.debit, l.credit]);

  it('splits goods and VAT when totals match', () => {
    const lines = buildInvoiceJournalLines({
      ...base,
      preVat: 1000,
      vat: 100,
      total: 1100,
    });
    expect(pick(lines)).toEqual([
      ['d', 1000, 0],
      ['v', 100, 0],
      ['a', 0, 1100],
    ]);
  });

  it('merges everything into the debit account when totals do not match', () => {
    const lines = buildInvoiceJournalLines({
      ...base,
      preVat: 1000,
      vat: 100,
      total: 2000,
    });
    expect(pick(lines)).toEqual([
      ['d', 2000, 0],
      ['a', 0, 2000],
    ]);
  });

  it('merges when there is no VAT account', () => {
    const lines = buildInvoiceJournalLines({
      ...base,
      vatAccountId: null,
      preVat: 1000,
      vat: 100,
      total: 1100,
    });
    expect(lines).toHaveLength(2);
  });

  it('keeps the entry balanced', () => {
    const lines = buildInvoiceJournalLines({
      ...base,
      preVat: 500,
      vat: 50,
      total: 550,
    });
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(credit);
  });
});
