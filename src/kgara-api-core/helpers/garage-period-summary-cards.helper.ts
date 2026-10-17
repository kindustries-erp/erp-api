import type { DashboardKpi } from '../../common/xlsx-charts/dashboard-sheet.helper';
import type { PeriodSummary } from './garage-period-summary.builder';

/** Dự chi trong kỳ: phiếu chi Chờ duyệt + Đã duyệt. Đã thu/đã chi/dòng tiền ròng nằm ở chart. */
export function buildPlannedPaymentKpis(
  summary: PeriodSummary,
): DashboardKpi[] {
  return [{ label: 'DỰ CHI TRONG KỲ', value: summary.cashflow.planned }];
}

/** Công nợ phát sinh trong kỳ của hai phía: chỉ số phát sinh (phiếu hoàn thành trong kỳ). */
export function buildPeriodDebtKpis(summary: PeriodSummary): DashboardKpi[] {
  return [
    {
      label: 'PHẢI THU PHÁT SINH TRONG KỲ (KH)',
      value: summary.periodReceivable.total,
    },
    {
      label: 'PHẢI TRẢ PHÁT SINH TRONG KỲ (NCC)',
      value: summary.periodPayable.total,
    },
  ];
}
