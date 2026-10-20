/**
 * Join gộp tổng cấn trừ PAYMENT theo vụ việc (alias "pay").
 * Gộp trước khi join để không nhân bản dòng; cần alias "c" của kgara_cases.
 */
export const PAYMENT_BY_CASE_JOIN = `LEFT JOIN (
  SELECT "case_id", SUM("amount")::numeric AS "paid"
  FROM "kgara_case_settlements"
  WHERE "settlement_type" = 'PAYMENT' AND "case_id" IS NOT NULL
  GROUP BY "case_id"
) "pay" ON "pay"."case_id" = "c"."id"`;

export interface PayableSqlExprs {
  /** Tổng đã chi (PAYMENT) của vụ việc, 0 nếu chưa có. */
  paidExpr: string;
  /** Còn phải trả của MỘT vụ việc = max(0, chi phí - đã chi); trả dư không bù sang vụ khác. */
  balanceExpr: string;
  /** Giữ dòng có chi phí hoặc có khoản đã chi (kể cả chi phí = 0). */
  hasPayableCondition: string;
}

export function buildPayableExprs(costExpr: string): PayableSqlExprs {
  const paidExpr = 'COALESCE("pay"."paid", 0)::numeric';
  return {
    paidExpr,
    balanceExpr: `GREATEST(${costExpr} - ${paidExpr}, 0)`,
    hasPayableCondition: `(${costExpr} > 0 OR ${paidExpr} <> 0)`,
  };
}
