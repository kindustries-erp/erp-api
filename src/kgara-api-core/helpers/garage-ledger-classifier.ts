import type { PeriodVoucherRow } from '../services/garage-period-report-queries.service';
import type { GaragePaymentRuleInput } from './garage-cashflow-payment-rules';

/**
 * Nhóm dòng tiền của một phiếu thu/chi xưởng. Đây là nguồn định nghĩa duy nhất cho
 * Thực thu, Dự thu, Thực chi, Dự chi trong báo cáo Excel và Hub.
 * - ACTUAL_IN: phiếu thu đã thu (không phải Dự thu, không hủy)
 * - EXPECTED_IN: phiếu thu dự kiến (status EXPECTED, tự tạo khi case hoàn tất)
 * - ACTUAL_OUT: phiếu chi đã chi (PAID, hoặc phiếu cũ không có status)
 * - PLANNED_OUT: phiếu chi Chờ duyệt hoặc Đã duyệt (chưa phải chi thực tế)
 */
export type LedgerCategory =
  | 'ACTUAL_IN'
  | 'EXPECTED_IN'
  | 'ACTUAL_OUT'
  | 'PLANNED_OUT';

/** Một phiếu thu/chi trong kỳ đã gán nhóm dòng tiền (phiếu đã hủy không có trong danh sách). */
export interface LedgerVoucherRow extends PeriodVoucherRow {
  category: LedgerCategory;
}

/** Phân loại phiếu; `null` = không tính vào bất kỳ tổng nào (đã hủy hoặc trạng thái không hợp lệ). */
export function classifyVoucher(
  v: GaragePaymentRuleInput,
): LedgerCategory | null {
  if (v.paymentStatus === 'CANCELLED') return null;

  if (v.voucherType === 'RECEIPT') {
    return v.paymentStatus === 'EXPECTED' ? 'EXPECTED_IN' : 'ACTUAL_IN';
  }

  if (v.voucherType === 'PAYMENT') {
    if (v.paymentStatus === 'PENDING' || v.paymentStatus === 'APPROVED') {
      return 'PLANNED_OUT';
    }
    if (v.paymentStatus === 'PAID' || !v.paymentStatus) return 'ACTUAL_OUT';
  }

  return null;
}

/** Tổng theo nhóm dòng tiền; `net` = thực thu − thực chi. */
export interface LedgerTotals {
  actualIn: number;
  expectedIn: number;
  actualOut: number;
  plannedOut: number;
  net: number;
}

/** Cộng tiền theo nhóm; phiếu không có nhóm (đã hủy) không được truyền vào. */
export function summarizeLedger(
  rows: { category: LedgerCategory; amount: number }[],
): LedgerTotals {
  const totals: Record<LedgerCategory, number> = {
    ACTUAL_IN: 0,
    EXPECTED_IN: 0,
    ACTUAL_OUT: 0,
    PLANNED_OUT: 0,
  };
  for (const row of rows) {
    totals[row.category] += Number(row.amount) || 0;
  }
  return {
    actualIn: totals.ACTUAL_IN,
    expectedIn: totals.EXPECTED_IN,
    actualOut: totals.ACTUAL_OUT,
    plannedOut: totals.PLANNED_OUT,
    net: totals.ACTUAL_IN - totals.ACTUAL_OUT,
  };
}
