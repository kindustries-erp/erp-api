import {
  applyNetOffJoin,
  NET_OFF_SUM_SQL,
  REMAINING_AMOUNT_SQL,
} from './invoice-netoff.helper';

describe('invoice-netoff.helper', () => {
  it('unifies voucher and adjustment netoff rows into one sum per invoice', () => {
    const qb = { leftJoin: jest.fn().mockReturnThis() };

    applyNetOffJoin(qb as never);

    const [subquery, alias, condition] = qb.leftJoin.mock.calls[0];
    expect(subquery).toContain('erp_invoice_voucher_netoff');
    expect(subquery).toContain('erp_invoice_adjustment_netoff');
    expect(subquery).toContain('GROUP BY invoice_id');
    expect(alias).toBe('netoff_agg');
    expect(condition).toBe('netoff_agg.invoice_id = e.id');
  });

  it('defaults the netoff sum to zero when an invoice has none', () => {
    expect(NET_OFF_SUM_SQL).toBe('COALESCE(netoff_agg.net_off_sum, 0)');
  });

  it('uses the adjustment branch for status 3 or negative totals', () => {
    expect(REMAINING_AMOUNT_SQL).toContain('e.taxInvoiceStatus = 3');
    expect(REMAINING_AMOUNT_SQL).toContain('e.totalAmount < 0');
    expect(REMAINING_AMOUNT_SQL).toContain('ABS(e.totalAmount)');
  });

  it('floors the normal remaining amount at zero', () => {
    expect(REMAINING_AMOUNT_SQL).toContain(
      'GREATEST(0, e.totalAmount - COALESCE(netoff_agg.net_off_sum, 0))',
    );
  });
});
