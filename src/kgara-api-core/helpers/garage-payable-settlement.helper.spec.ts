import {
  PAYMENT_BY_CASE_JOIN,
  buildPayableExprs,
} from './garage-payable-settlement.helper';

describe('garage-payable-settlement.helper', () => {
  const cost = 'COALESCE("gp"."chi_phi", "c"."chi_phi", 0)::numeric';

  it('join chỉ gộp PAYMENT theo case_id và nối qua c.id', () => {
    expect(PAYMENT_BY_CASE_JOIN).toContain(`"settlement_type" = 'PAYMENT'`);
    expect(PAYMENT_BY_CASE_JOIN).toContain('GROUP BY "case_id"');
    expect(PAYMENT_BY_CASE_JOIN).toContain('"pay"."case_id" = "c"."id"');
  });

  it('paid = 0 khi không có PAYMENT, balance = cost - paid (không chặn trần)', () => {
    const { paidExpr, balanceExpr } = buildPayableExprs(cost);
    expect(paidExpr).toBe('COALESCE("pay"."paid", 0)::numeric');
    expect(balanceExpr).toBe(`(${cost} - ${paidExpr})`);
    expect(balanceExpr).not.toContain('LEAST');
  });

  it('giữ vụ việc chi phí 0 nhưng đã chi', () => {
    const { hasPayableCondition, paidExpr } = buildPayableExprs(cost);
    expect(hasPayableCondition).toBe(`(${cost} > 0 OR ${paidExpr} <> 0)`);
  });
});
