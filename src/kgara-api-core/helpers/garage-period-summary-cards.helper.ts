import type {
  DashboardAlertCard,
  DashboardKpi,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  OVERDUE_LEVEL_STYLE,
  type OverdueSummary,
} from './garage-overdue-warning.helper';
import type {
  PeriodDebtSummary,
  PeriodSummary,
} from './garage-period-summary.builder';

const PERCENT_FMT = '0.0%';
const NEUTRAL = { fill: 'FFF1F5F9', font: 'FF64748B' };
const TOTAL_STYLE = { fill: 'FFE0F2FE', font: 'FF075985' };

const rateNote = (amount: number, total: number) =>
  total > 0 && amount > 0
    ? `${((amount / total) * 100).toFixed(1).replace('.', ',')}% tổng nợ`
    : 'Không có';

/** Thu chi trong kỳ: đã thu, đã chi, dòng tiền ròng (thẻ KPI 2 dòng). */
export function buildCashflowKpis(summary: PeriodSummary): DashboardKpi[] {
  return [
    { label: 'ĐÃ THU TRONG KỲ', value: summary.cashflow.received },
    { label: 'ĐÃ CHI TRONG KỲ', value: summary.cashflow.paid },
    { label: 'DÒNG TIỀN RÒNG (THU - CHI)', value: summary.cashflow.net },
  ];
}

/** Công nợ phát sinh trong kỳ của một phía: phát sinh, đã thu/trả, còn lại (thẻ KPI 2 dòng). */
export function buildPeriodDebtKpis(
  side: 'receivable' | 'payable',
  debt: PeriodDebtSummary,
): DashboardKpi[] {
  const isReceivable = side === 'receivable';
  return [
    { label: 'PHÁT SINH TRONG KỲ', value: debt.total },
    { label: isReceivable ? 'ĐÃ THU' : 'ĐÃ TRẢ', value: debt.paid },
    { label: 'CÒN LẠI', value: debt.balance },
  ];
}

/**
 * Công nợ lũy kế của một phía: tổng nợ còn mở, nợ 31-60 / 61-90 / trên 90 ngày (ghi chú %
 * tổng nợ) và tỷ lệ quá hạn. Không ghi số đối tượng; bậc không có nợ hiển thị nền xám.
 */
export function buildDebtCards(s: OverdueSummary): DashboardAlertCard[] {
  const side = s.sideLabel.toUpperCase();
  const level = OVERDUE_LEVEL_STYLE[s.level];
  const bucket = (
    label: string,
    amount: number,
    style: { fill: string; font: string },
  ): DashboardAlertCard => ({
    label: `${side}: ${label}`,
    value: amount,
    note: rateNote(amount, s.totalBalance),
    ...(amount > 0 ? style : NEUTRAL),
  });

  return [
    {
      label: `${side}: TỔNG NỢ CÒN MỞ`,
      value: s.totalBalance,
      note: 'Tính đến ngày xuất',
      ...TOTAL_STYLE,
    },
    bucket('NỢ 31-60 NGÀY', s.b31_60, OVERDUE_LEVEL_STYLE.WATCH),
    bucket('NỢ 61-90 NGÀY', s.b61_90, OVERDUE_LEVEL_STYLE.MEDIUM),
    bucket('NỢ TRÊN 90 NGÀY', s.over90, OVERDUE_LEVEL_STYLE.HIGH),
    {
      label: `${side}: TỶ LỆ QUÁ HẠN`,
      value: s.overdueRate,
      numFmt: PERCENT_FMT,
      note: 'Quá hạn trên 30 ngày / tổng nợ còn mở',
      ...(s.overdueAmount > 0 ? level : NEUTRAL),
    },
  ];
}
