import { formatInvoiceProgressRef } from './invoice-progress-ref.helper';

describe('invoice-progress-ref.helper', () => {
  it('joins invoice number, serial and partner name', () => {
    expect(
      formatInvoiceProgressRef({
        invoiceNo: '1847',
        serialNo: 'C26MSP',
        partnerName: 'CÔNG TY ABC',
      }),
    ).toBe('HĐ 1847 · C26MSP · CÔNG TY ABC');
  });

  it('skips missing parts', () => {
    expect(formatInvoiceProgressRef({ invoiceNo: '12', serialNo: null })).toBe(
      'HĐ 12',
    );
    expect(formatInvoiceProgressRef({ partnerName: 'ABC' })).toBe('ABC');
  });

  it('returns an empty string when nothing is known', () => {
    expect(formatInvoiceProgressRef({})).toBe('');
    expect(formatInvoiceProgressRef({ invoiceNo: '  ' })).toBe('');
  });

  it('trims and truncates long partner names', () => {
    const long = `  ${'A'.repeat(60)}  `;
    const ref = formatInvoiceProgressRef({ invoiceNo: '1', partnerName: long });
    expect(ref).toBe(`HĐ 1 · ${'A'.repeat(39)}…`);
  });
});
