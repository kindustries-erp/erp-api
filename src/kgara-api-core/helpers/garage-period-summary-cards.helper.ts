import type { DashboardKpi } from '../../common/xlsx-charts/dashboard-sheet.helper';
import type { PeriodSummary } from './garage-period-summary.builder';

const fmtPct = (value: number) =>
  `${Math.abs(value).toFixed(1).replace('.', ',')}%`;

/** Dòng so sánh ±% với kỳ trước; thiếu số kỳ trước thì không có dòng. */
export function trendNote(
  current: number,
  previous: number | undefined,
): string | undefined {
  if (previous === undefined) return undefined;
  if (previous === 0) {
    return current === 0 ? 'Không đổi so với kỳ trước' : 'Kỳ trước: 0';
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.05) return 'Không đổi so với kỳ trước';
  const sign = change > 0 ? '+' : '-';
  return `${sign}${fmtPct(change)} so với kỳ trước`;
}

/** Thu chi trong kỳ: đã thu, đã chi, dự chi, dòng tiền ròng; mỗi thẻ có ±% so với kỳ trước. */
export function buildCashflowKpis(summary: PeriodSummary): DashboardKpi[] {
  const { cashflow } = summary;
  const prev = summary.previous;
  const prevNet = prev ? prev.received - prev.paid : undefined;
  return [
    {
      label: 'ĐÃ THU TRONG KỲ',
      value: cashflow.received,
      note: trendNote(cashflow.received, prev?.received),
    },
    {
      label: 'ĐÃ CHI TRONG KỲ',
      value: cashflow.paid,
      note: trendNote(cashflow.paid, prev?.paid),
    },
    {
      label: 'DỰ CHI TRONG KỲ',
      value: cashflow.planned,
      note: trendNote(cashflow.planned, prev?.planned),
    },
    {
      label: 'DÒNG TIỀN RÒNG (THU - CHI)',
      value: cashflow.net,
      note: trendNote(cashflow.net, prevNet),
    },
  ];
}

/** Công nợ phát sinh trong kỳ của hai phía: phát sinh kỳ này, kèm ±% so với kỳ trước. */
export function buildPeriodDebtKpis(summary: PeriodSummary): DashboardKpi[] {
  const prev = summary.previous;
  return [
    {
      label: 'PHẢI THU PHÁT SINH (KH)',
      value: summary.periodReceivable.total,
      note: trendNote(summary.periodReceivable.total, prev?.receivableTotal),
    },
    {
      label: 'PHẢI CHI PHÁT SINH (NCC)',
      value: summary.periodPayable.total,
      note: trendNote(summary.periodPayable.total, prev?.payableTotal),
    },
  ];
}

/** Tỷ lệ phần trăm của một khoản trên tổng nợ, ghi chú ngắn. */
const shareNote = (amount: number, total: number) =>
  total > 0 && amount > 0
    ? `${((amount / total) * 100).toFixed(1).replace('.', ',')}% tổng nợ`
    : 'Không có';

/**
 * Công nợ lũy kế đến ngày xuất của hai phía (4 thẻ): còn mở của phải thu và phải chi, và nợ
 * trên 60 ngày của mỗi phía (ghi chú % trên tổng nợ còn mở).
 */
export function buildOpenDebtKpis(summary: PeriodSummary): DashboardKpi[] {
  const { receivable, payable } = summary;
  const over60 = (s: typeof receivable) => s.b61_90 + s.over90;
  return [
    { label: 'PHẢI THU CÒN MỞ (KH)', value: receivable.totalBalance },
    { label: 'PHẢI CHI CÒN MỞ (NCC)', value: payable.totalBalance },
    {
      label: 'PHẢI THU QUÁ 60 NGÀY (KH)',
      value: over60(receivable),
      note: shareNote(over60(receivable), receivable.totalBalance),
    },
    {
      label: 'PHẢI CHI QUÁ 60 NGÀY (NCC)',
      value: over60(payable),
      note: shareNote(over60(payable), payable.totalBalance),
    },
  ];
}
