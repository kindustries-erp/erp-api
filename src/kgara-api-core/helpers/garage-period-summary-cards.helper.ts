import type {
  DashboardAlertCard,
  DashboardKpi,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  OVERDUE_LEVEL_STYLE,
  type OverdueSummary,
} from './garage-overdue-warning.helper';
import type { PeriodSummary } from './garage-period-summary.builder';

const NEUTRAL = { fill: 'FFF1F5F9', font: 'FF64748B' };

const rateNote = (amount: number, total: number) =>
  total > 0 && amount > 0
    ? `${((amount / total) * 100).toFixed(1).replace('.', ',')}% tổng nợ`
    : 'Không có';

/** Thu chi trong kỳ: đã thu, đã chi, dự chi (Chờ duyệt + Đã duyệt), dòng tiền ròng. */
export function buildCashflowKpis(summary: PeriodSummary): DashboardKpi[] {
  return [
    { label: 'ĐÃ THU TRONG KỲ', value: summary.cashflow.received },
    { label: 'ĐÃ CHI TRONG KỲ', value: summary.cashflow.paid },
    { label: 'DỰ CHI TRONG KỲ', value: summary.cashflow.planned },
    { label: 'DÒNG TIỀN RÒNG (THU - CHI)', value: summary.cashflow.net },
  ];
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

/** Một bậc tuổi nợ (61-90 hoặc trên 90 ngày) của một phía: ghi chú % tổng nợ, không có nợ thì nền xám. */
function overdueBucketCard(
  side: string,
  label: string,
  amount: number,
  totalBalance: number,
  style: { fill: string; font: string },
): DashboardAlertCard {
  return {
    label: `${side}: ${label}`,
    value: amount,
    note: rateNote(amount, totalBalance),
    ...(amount > 0 ? style : NEUTRAL),
  };
}

/**
 * Cảnh báo lũy kế đến ngày xuất: chỉ nợ 61-90 và trên 90 ngày của cả phải thu và phải trả
 * (4 thẻ trên một hàng). Không ghi số đối tượng.
 */
export function buildOverdueAlertCards(
  receivable: OverdueSummary,
  payable: OverdueSummary,
): DashboardAlertCard[] {
  const cards = (s: OverdueSummary) => {
    const side = s.sideLabel.toUpperCase();
    return [
      overdueBucketCard(
        side,
        'NỢ 61-90 NGÀY',
        s.b61_90,
        s.totalBalance,
        OVERDUE_LEVEL_STYLE.MEDIUM,
      ),
      overdueBucketCard(
        side,
        'NỢ TRÊN 90 NGÀY',
        s.over90,
        s.totalBalance,
        OVERDUE_LEVEL_STYLE.HIGH,
      ),
    ];
  };
  return [...cards(receivable), ...cards(payable)];
}
