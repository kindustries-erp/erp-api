import type {
  GaragePeriodReportSectionKey,
  GaragePeriodReportType,
} from '../dto/garage-export.dto';

/** Các khối (sheet) có thể xuất hiện trong file báo cáo Garage theo kỳ. */
export type GaragePeriodReportSection =
  | 'dashboard'
  | 'pnl'
  | 'receivables'
  | 'payables'
  | 'overdue'
  | 'cashflow';

const SECTIONS_BY_TYPE: Record<
  GaragePeriodReportType,
  readonly GaragePeriodReportSection[]
> = {
  all: ['dashboard', 'pnl', 'receivables', 'payables', 'overdue', 'cashflow'],
  business: ['pnl'],
  'cashflow-debts': ['dashboard', 'receivables', 'payables', 'cashflow'],
  overdue: ['overdue'],
};

const SECTION_BY_KEY: Record<
  GaragePeriodReportSectionKey,
  GaragePeriodReportSection
> = {
  overview: 'dashboard',
  pnl: 'pnl',
  receivables: 'receivables',
  payables: 'payables',
  overdue: 'overdue',
  cashflow: 'cashflow',
};

/**
 * Danh sách section cần xuất. Có `reportSections` (multi-select) thì dùng đúng các mục đó;
 * không thì theo `reportType` (cũ); thiếu cả hai thì xuất toàn bộ.
 */
export function resolvePeriodReportSections(
  reportType?: GaragePeriodReportType,
  reportSections?: readonly GaragePeriodReportSectionKey[],
): ReadonlySet<GaragePeriodReportSection> {
  if (reportSections && reportSections.length > 0) {
    return new Set(reportSections.map((key) => SECTION_BY_KEY[key]));
  }
  return new Set(SECTIONS_BY_TYPE[reportType ?? 'all'] ?? SECTIONS_BY_TYPE.all);
}
