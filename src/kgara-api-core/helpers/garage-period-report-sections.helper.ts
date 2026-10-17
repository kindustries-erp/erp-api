import type { GaragePeriodReportType } from '../dto/garage-export.dto';

/** Các khối (sheet) có thể xuất hiện trong file báo cáo Garage theo kỳ. */
export type GaragePeriodReportSection =
  | 'dashboard'
  | 'pnl'
  | 'debts'
  | 'overdue'
  | 'cashflow';

const SECTIONS_BY_TYPE: Record<
  GaragePeriodReportType,
  readonly GaragePeriodReportSection[]
> = {
  all: ['dashboard', 'pnl', 'debts', 'overdue', 'cashflow'],
  business: ['pnl'],
  'cashflow-debts': ['dashboard', 'debts', 'cashflow'],
  overdue: ['overdue'],
};

/** Danh sách section theo loại báo cáo; thiếu/không rõ loại thì xuất toàn bộ. */
export function resolvePeriodReportSections(
  reportType?: GaragePeriodReportType,
): ReadonlySet<GaragePeriodReportSection> {
  return new Set(SECTIONS_BY_TYPE[reportType ?? 'all'] ?? SECTIONS_BY_TYPE.all);
}
