import type { DashboardAlertCard } from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  debtRowLabel,
  type GarageDebtExportRow,
} from './garage-debts-export.helper';

export type OverdueLevel = 'HIGH' | 'MEDIUM' | 'WATCH' | 'OK';
export type OverdueSide = 'receivable' | 'payable';

export interface OverdueSummary {
  side: OverdueSide;
  sideLabel: string;
  partnerCount: number;
  totalBalance: number;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  over90: number;
  /** Nợ quá hạn = tuổi nợ trên 30 ngày. */
  overdueAmount: number;
  /** Tỷ lệ quá hạn trên tổng nợ (0..1). */
  overdueRate: number;
  count31_60: number;
  count61_90: number;
  countOver90: number;
  /** Đối tượng có nợ trên 90 ngày lớn nhất. */
  topOver90?: { label: string; amount: number };
  level: OverdueLevel;
}

const SIDE_LABEL: Record<OverdueSide, string> = {
  receivable: 'Phải thu',
  payable: 'Phải trả',
};

/** Màu nền/chữ theo mức cảnh báo, khớp bảng màu tuổi nợ trên web. */
export const OVERDUE_LEVEL_STYLE: Record<
  OverdueLevel,
  { fill: string; font: string; tag: string }
> = {
  HIGH: { fill: 'FFFEE2E2', font: 'FFBE123C', tag: 'CAO' },
  MEDIUM: { fill: 'FFFFEDD5', font: 'FFC2410C', tag: 'TRUNG BÌNH' },
  WATCH: { fill: 'FFFEF3C7', font: 'FF92400E', tag: 'CHÚ Ý' },
  OK: { fill: 'FFD1FAE5', font: 'FF065F46', tag: 'ỔN' },
};

const num = (value: unknown) => Number(value) || 0;

/** `85.000.000 đ` (dấu chấm ngăn cách, không phụ thuộc ICU của Node). */
export const formatVnd = (value: number) =>
  `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;

const formatPercent = (rate: number) =>
  `${(rate * 100).toFixed(1).replace('.', ',')}%`;

/** Mức cảnh báo theo bậc tuổi nợ cao nhất còn dư nợ. */
export function levelOf(
  s: Pick<OverdueSummary, 'over90' | 'b61_90' | 'b31_60'>,
): OverdueLevel {
  if (s.over90 > 0) return 'HIGH';
  if (s.b61_90 > 0) return 'MEDIUM';
  if (s.b31_60 > 0) return 'WATCH';
  return 'OK';
}

/** Gom tuổi nợ của một phía (phải thu hoặc phải trả) từ các dòng công nợ. */
export function summarizeOverdue(
  side: OverdueSide,
  rows: GarageDebtExportRow[],
): OverdueSummary {
  const summary: OverdueSummary = {
    side,
    sideLabel: SIDE_LABEL[side],
    partnerCount: 0,
    totalBalance: 0,
    b0_30: 0,
    b31_60: 0,
    b61_90: 0,
    over90: 0,
    overdueAmount: 0,
    overdueRate: 0,
    count31_60: 0,
    count61_90: 0,
    countOver90: 0,
    level: 'OK',
  };

  for (const row of rows) {
    const a031 = num(row.aging0_30);
    const a3160 = num(row.aging31_60);
    const a6190 = num(row.aging61_90);
    const a90 = num(row.agingOver90);
    if (a031 + a3160 + a6190 + a90 <= 0) continue;

    summary.partnerCount += 1;
    summary.b0_30 += a031;
    summary.b31_60 += a3160;
    summary.b61_90 += a6190;
    summary.over90 += a90;
    if (a3160 > 0) summary.count31_60 += 1;
    if (a6190 > 0) summary.count61_90 += 1;
    if (a90 > 0) {
      summary.countOver90 += 1;
      if (!summary.topOver90 || a90 > summary.topOver90.amount) {
        summary.topOver90 = { label: debtRowLabel(row), amount: a90 };
      }
    }
  }

  summary.totalBalance =
    summary.b0_30 + summary.b31_60 + summary.b61_90 + summary.over90;
  summary.overdueAmount = summary.b31_60 + summary.b61_90 + summary.over90;
  summary.overdueRate =
    summary.totalBalance > 0 ? summary.overdueAmount / summary.totalBalance : 0;
  summary.level = levelOf(summary);
  return summary;
}

const NEUTRAL_CARD = { fill: 'FFF1F5F9', font: 'FF64748B' };

/**
 * 4 thẻ cảnh báo cho một phía: mức cảnh báo, nợ trên 90 ngày (kèm đối tượng lớn nhất),
 * nợ 61-90 ngày và nợ 31-60 ngày. Bậc không có nợ hiển thị nền xám nhạt.
 */
export function buildOverdueCards(s: OverdueSummary): DashboardAlertCard[] {
  const level = OVERDUE_LEVEL_STYLE[s.level];
  const top = s.topOver90
    ? `; lớn nhất: ${s.topOver90.label} (${formatVnd(s.topOver90.amount)})`
    : '';
  const bucket = (
    label: string,
    amount: number,
    count: number,
    style: { fill: string; font: string },
    note: string,
  ): DashboardAlertCard => ({
    label: `${s.sideLabel.toUpperCase()}: ${label}`,
    value: amount,
    note: amount > 0 ? `${count} đối tượng${note}` : 'Không có',
    ...(amount > 0 ? style : NEUTRAL_CARD),
  });

  return [
    {
      label: `${s.sideLabel.toUpperCase()}: MỨC CẢNH BÁO`,
      value: level.tag,
      note:
        s.level === 'OK'
          ? 'Không có nợ quá hạn trên 30 ngày'
          : `Quá hạn >30 ngày: ${formatPercent(s.overdueRate)} tổng nợ (${formatVnd(s.overdueAmount)})`,
      fill: level.fill,
      font: level.font,
    },
    bucket(
      'NỢ TRÊN 90 NGÀY',
      s.over90,
      s.countOver90,
      OVERDUE_LEVEL_STYLE.HIGH,
      top,
    ),
    bucket(
      'NỢ 61-90 NGÀY',
      s.b61_90,
      s.count61_90,
      OVERDUE_LEVEL_STYLE.MEDIUM,
      '',
    ),
    bucket(
      'NỢ 31-60 NGÀY',
      s.b31_60,
      s.count31_60,
      OVERDUE_LEVEL_STYLE.WATCH,
      '',
    ),
  ];
}
