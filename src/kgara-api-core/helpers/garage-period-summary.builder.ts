import {
  summarizeOverdue,
  type OverdueSummary,
} from './garage-overdue-warning.helper';
import type { GarageDebtExportRow } from './garage-debts-export.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import { isPlannedPayment } from './garage-period-series.helper';

/** Công nợ của các phiếu hoàn thành trong kỳ: phát sinh, đã thu/trả và còn lại. */
export interface PeriodDebtSummary {
  total: number;
  paid: number;
  balance: number;
}

/** Các số tổng của sheet Dashboard báo cáo kỳ; không có số đối tượng. */
export interface PeriodSummary {
  /** Đã thu/đã chi/dòng tiền ròng: tổng mọi phiếu trong kỳ. `planned` = phiếu chi Chờ duyệt + Đã duyệt. */
  cashflow: { received: number; paid: number; net: number; planned: number };
  /** Công nợ phát sinh trong kỳ (phiếu hoàn thành trong kỳ). */
  periodReceivable: PeriodDebtSummary;
  periodPayable: PeriodDebtSummary;
  /** Công nợ lũy kế: nợ mở từ mốc ghi nhận đến ngày xuất, kèm tuổi nợ. */
  receivable: OverdueSummary;
  payable: OverdueSummary;
  /** Số kỳ trước để so sánh ±%; thiếu khi báo cáo không có kỳ hoặc kỳ trước trước mốc ghi nhận. */
  previous?: PeriodComparison;
}

export interface PeriodComparison {
  received: number;
  paid: number;
  planned: number;
  receivableTotal: number;
  payableTotal: number;
}

const num = (value: unknown) => Number(value) || 0;

const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((acc, item) => acc + num(pick(item)), 0);

const periodDebt = (rows: GarageDebtExportRow[]): PeriodDebtSummary => ({
  total: sum(rows, (r) => r.totalAmount),
  paid: sum(rows, (r) => r.paidAmount),
  balance: sum(rows, (r) => r.balanceAmount),
});

/**
 * Gom số tổng cho Dashboard: thu chi trong kỳ, công nợ phát sinh trong kỳ và công nợ
 * lũy kế (nợ mở đến ngày xuất, tuổi nợ phải thu/phải trả).
 */
export function summarizePeriod(data: GaragePeriodReportData): PeriodSummary {
  const received = sum(
    data.vouchers.filter((v) => v.type === 'RECEIPT'),
    (v) => v.amount,
  );
  const paid = sum(
    data.vouchers.filter((v) => v.type === 'PAYMENT'),
    (v) => v.amount,
  );

  const planned = sum(data.vouchers.filter(isPlannedPayment), (v) => v.amount);

  return {
    cashflow: { received, paid, net: received - paid, planned },
    periodReceivable: periodDebt(data.customerRows),
    periodPayable: periodDebt(data.supplierRows),
    receivable: summarizeOverdue('receivable', data.openCustomerRows),
    payable: summarizeOverdue('payable', data.openSupplierRows),
    previous: data.previousPeriod
      ? comparisonOf(data.previousPeriod)
      : undefined,
  };
}

/** Số so sánh của kỳ trước: dự chi và công nợ phát sinh hai phía (cùng quy tắc kỳ hiện tại). */
function comparisonOf(
  prev: NonNullable<GaragePeriodReportData['previousPeriod']>,
) {
  return {
    received: sum(
      prev.vouchers.filter((v) => v.type === 'RECEIPT'),
      (v) => v.amount,
    ),
    paid: sum(
      prev.vouchers.filter((v) => v.type === 'PAYMENT'),
      (v) => v.amount,
    ),
    planned: sum(prev.vouchers.filter(isPlannedPayment), (v) => v.amount),
    receivableTotal: periodDebt(prev.customerRows).total,
    payableTotal: periodDebt(prev.supplierRows).total,
  };
}
