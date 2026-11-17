import { computeDiscountCaseFix } from './kgara-discount-receivable.helper';

/**
 * Định nghĩa duy nhất "còn phải thu" của phiếu Kgara, dùng chung cho thẻ tuổi nợ,
 * ma trận tuổi nợ và bảng phân loại trong drawer.
 * - Số ròng = tien_co_thue (đã trừ chiết khấu).
 * - Đã thu = tổng settlement RECEIPT nếu có; không có thì giữ tien_da_thanh_toan đã lưu.
 * - Còn phải thu = max(0, số ròng − đã thu).
 * - Phiếu loại trừ công nợ (exclude_from_debt) không tính vào đâu cả.
 */

export interface CaseRemainingInput {
  /** tien_co_thue đã lưu, là số ròng sau chiết khấu. */
  netRevenue: number | string | null | undefined;
  /** tien_da_thanh_toan đã lưu (dùng khi không có settlement). */
  storedPaid: number | string | null | undefined;
  /** Phiếu có settlement RECEIPT hay không. */
  hasSettlement: boolean;
  /** Tổng settlement RECEIPT của phiếu (chỉ dùng khi hasSettlement). */
  receipts: number | string | null | undefined;
  /** Phiếu bị loại khỏi công nợ. */
  excludeFromDebt: boolean | null | undefined;
}

export interface CaseRemainingResult {
  paid: number;
  remaining: number;
}

export function computeCaseRemaining(
  input: CaseRemainingInput,
): CaseRemainingResult {
  if (input.excludeFromDebt === true) {
    return { paid: 0, remaining: 0 };
  }
  return computeDiscountCaseFix({
    tienCoThue: toNumber(input.netRevenue),
    storedPaid: toNumber(input.storedPaid),
    hasSettlement: input.hasSettlement,
    receipts: toNumber(input.receipts),
  });
}

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * SQL dùng chung: tổng settlement RECEIPT theo phiếu (alias `rc`, cần bảng `"c"` là kgara_cases).
 * Phiếu không có settlement RECEIPT thì rc.receipts là NULL.
 */
export const RECEIPT_BY_CASE_JOIN = `LEFT JOIN (
  SELECT s.case_id, SUM(s.amount)::numeric AS receipts
  FROM kgara_case_settlements s
  WHERE s.settlement_type = 'RECEIPT' AND s.case_id IS NOT NULL
  GROUP BY s.case_id
) rc ON rc.case_id = "c"."id"`;

/** Đã thu theo công thức mới: settlement RECEIPT nếu có, không thì tien_da_thanh_toan đã lưu. */
export const CASE_PAID_SQL = `COALESCE(rc.receipts, "c"."tien_da_thanh_toan", 0)`;

/** Còn phải thu theo công thức mới: max(0, số ròng − đã thu). Dùng với RECEIPT_BY_CASE_JOIN. */
export const CASE_REMAINING_SQL = `GREATEST(COALESCE("c"."tien_co_thue", 0) - ${CASE_PAID_SQL}, 0)`;
