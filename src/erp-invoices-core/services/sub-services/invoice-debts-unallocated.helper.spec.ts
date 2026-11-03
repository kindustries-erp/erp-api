import { buildUnallocatedByTaxSql } from './invoice-debts-unallocated.helper';

describe('buildUnallocatedByTaxSql', () => {
  it('counts receipts (credit) for customers (OUT)', () => {
    const sql = buildUnallocatedByTaxSql('OUT');
    expect(sql).toContain('t.credit_amount > 0');
    expect(sql).not.toContain('t.debit_amount > 0');
  });

  it('counts payments (debit) for suppliers (IN)', () => {
    const sql = buildUnallocatedByTaxSql('IN');
    expect(sql).toContain('t.debit_amount > 0');
    expect(sql).not.toContain('t.credit_amount > 0');
  });

  it('subtracts net-off per transaction and never goes below zero', () => {
    const sql = buildUnallocatedByTaxSql('OUT');
    expect(sql).toContain(
      'GREATEST(0, GREATEST(t.credit_amount, t.debit_amount)',
    );
    expect(sql).toContain('COALESCE(n.net_off, 0)');
  });

  it('groups by tax code and only uses transactions linked to an active partner', () => {
    const sql = buildUnallocatedByTaxSql('IN');
    expect(sql).toContain(
      'JOIN erp_business_partners p ON p.id = t.partner_id AND p.is_deleted = false',
    );
    expect(sql).toContain('GROUP BY p.tax_code');
    expect(sql).toContain('t.is_deleted = false');
  });
});
