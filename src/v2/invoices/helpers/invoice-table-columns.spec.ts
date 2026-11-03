import { resolveTableColumn } from '@/common/utils/table-query';
import {
  INVOICE_SUMMARY_COLUMNS,
  INVOICE_TABLE_COLUMNS,
} from './invoice-table-columns';

describe('invoice-table-columns', () => {
  it('resolves partner and tax code by direction', () => {
    const partner = resolveTableColumn(INVOICE_TABLE_COLUMNS, 'partner');
    const taxCode = resolveTableColumn(INVOICE_TABLE_COLUMNS, 'taxCode');

    expect(partner?.sql).toContain("e.direction = 'OUT' THEN e.buyerName");
    expect(taxCode?.sql).toContain("e.direction = 'OUT' THEN e.buyerTaxCode");
  });

  it('exposes netoff and remaining as numeric columns for filter and sort', () => {
    expect(
      resolveTableColumn(INVOICE_TABLE_COLUMNS, 'netOffAmount')?.type,
    ).toBe('number');
    expect(
      resolveTableColumn(INVOICE_TABLE_COLUMNS, 'remainingAmount')?.type,
    ).toBe('number');
  });

  it('keeps tax invoice status numeric so blank selection uses IS NULL', () => {
    expect(
      resolveTableColumn(INVOICE_TABLE_COLUMNS, 'taxInvoiceStatus')?.type,
    ).toBe('number');
  });

  it('sums netoff and remaining in the summary row', () => {
    const keys = INVOICE_SUMMARY_COLUMNS.map((column) => column.key);

    expect(keys).toEqual(
      expect.arrayContaining(['netOffAmount', 'remainingAmount']),
    );
  });
});
