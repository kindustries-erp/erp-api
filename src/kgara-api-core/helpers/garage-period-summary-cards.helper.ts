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
