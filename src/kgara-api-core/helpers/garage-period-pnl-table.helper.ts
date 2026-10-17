import * as ExcelJS from 'exceljs';

import { borderThin } from './kgara-excel-style.helper';
import type { PnlLineItem, PnlMonthRow } from './garage-pnl-month.helper';

const MONEY = '#,##0';
const COUNT = '#,##0';
const PERCENT = '0.00%';
const RATE_KEY = 'RATE_LAI_GOP_KY_GUI';

const HEADER_FILL = 'FF334155';
const GROUP_FILL = 'FFE2E8F0';
const DETAIL_COLOR = 'FF475569';

/** Cấp 1: nhóm 1, 2, ...; cấp 2: hạng mục (1.1); cấp 3: chi tiết (1.1.1). */
export type PnlLevel = 1 | 2 | 3;

export interface PnlTableRow {
  /** Khóa ổn định của dòng, dùng để ghép với cùng dòng của tháng trước. */
  key: string;
  /** Nhãn đã có số thứ bậc (vd `1.1 Khác`). */
  label: string;
  value: number;
  level: PnlLevel;
  numFmt: string;
  /**
   * Tháng trước không có khóa này thì hiện 0 (tổng, phân loại, hạng mục); dòng chi tiết
   * nhập tay (ghi chú có thể đổi giữa hai tháng) thì để trống.
   */
  zeroIfMissing: boolean;
}

const solid = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

type Draft = Omit<PnlTableRow, 'label'> & { label: string };

const row =
  (level: PnlLevel) =>
  (
    key: string,
    label: string,
    value: number,
    numFmt = MONEY,
    zeroIfMissing = true,
  ): Draft => ({ key, label, value, level, numFmt, zeroIfMissing });

const l1 = row(1);
const l2 = row(2);
const l3 = row(3);

const round = (value: number) => Math.round(value);

/** Đánh số thứ bậc 1 / 1.1 / 1.1.1, reset số cấp dưới khi lên cấp trên. */
function numberRows(rows: Draft[]): PnlTableRow[] {
  const counters = [0, 0, 0];
  return rows.map((r) => {
    counters[r.level - 1] += 1;
    for (let i = r.level; i < counters.length; i++) counters[i] = 0;
    const number = counters.slice(0, r.level).join('.');
    // Cấp 1 có dấu chấm (1.), cấp 2 và 3 không (1.1, 1.1.1)
    const prefix = r.level === 1 ? `${number}.` : number;
    return { ...r, label: `${prefix} ${r.label}` };
  });
}

/** Chi phí vận hành: hạng mục (cấp 2, cộng các dòng cùng khóa) và từng dòng nhập (cấp 3). */
function opexRows(items: PnlLineItem[]): Draft[] {
  const groups = new Map<string, PnlLineItem[]>();
  for (const item of items) {
    const key = item.categoryKey || item.categoryName;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].flatMap(([groupKey, entries]) => {
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const showEntries = entries.length > 1 || entries.some((e) => e.note);
    const seen = new Map<string, number>();
    return [
      l2(`opex:${groupKey}`, entries[0].categoryName, total),
      ...(showEntries
        ? entries.map((e) => {
            // Khóa dòng nhập theo hạng mục + ghi chú; trùng ghi chú thì đánh số thứ tự
            const base = `opex:${groupKey}:${e.note ?? ''}`;
            const n = (seen.get(base) ?? 0) + 1;
            seen.set(base, n);
            return l3(
              `${base}#${n}`,
              e.note || 'Khoản chi',
              e.amount,
              MONEY,
              false,
            );
          })
        : []),
    ];
  });
}

/** Doanh thu theo phân loại (cấp 2) kèm số phiếu (cấp 3); thiếu phân loại thì một dòng như cũ. */
function revenueRows(m: PnlMonthRow): Draft[] {
  const segments = m.revenueSegments.filter((s) => s.revenue || s.caseCount);
  if (segments.length === 0) return [l2('rev:all', 'Doanh thu', m.revenue)];
  return segments.flatMap((s) => [
    l2(`rev:${s.key}`, s.label, s.revenue),
    l3(`rev:${s.key}:count`, 'Số phiếu hoàn thành', s.caseCount, COUNT),
  ]);
}

/** Giá vốn từ phiếu theo phân loại và điều chỉnh giá vốn nhập tay; thiếu chi tiết thì một dòng như cũ. */
function cogsRows(m: PnlMonthRow): Draft[] {
  const segments = m.revenueSegments.filter((s) => s.cogs);
  const adjustments = m.cogsAdjustmentItems;
  if (segments.length === 0 && adjustments.length === 0) {
    return [l2('cogs:all', 'Chi phí phụ tùng ngoài & Gia công ngoài', m.cogs)];
  }
  const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
  return [
    l2(
      'cogs:direct',
      'Giá vốn từ phiếu (phụ tùng ngoài & gia công ngoài)',
      m.cogsDirect,
    ),
    ...segments.map((s) => l3(`cogs:seg:${s.key}`, s.label, s.cogs)),
    ...(adjustments.length > 0
      ? [
          l2('cogs:adj', 'Điều chỉnh giá vốn nhập tay', adjustmentTotal),
          ...adjustments.map((a) =>
            l3(
              `cogs:adj:${a.categoryKey}:${a.note ?? ''}`,
              a.note ? `${a.categoryName} - ${a.note}` : a.categoryName,
              a.amount,
              MONEY,
              false,
            ),
          ),
        ]
      : []),
  ];
}

/**
 * Các dòng bảng "Báo cáo lợi nhuận" của một tháng (Danh mục, Giá trị), 3 cấp, đánh số
 * 1 / 1.1 / 1.1.1. Nhóm 6 gồm cả HHBH để nhóm 5 − nhóm 6 = nhóm 7 luôn đúng.
 */
export function buildPnlTableRows(m: PnlMonthRow): PnlTableRow[] {
  return numberRows([
    l1('rev', 'Doanh thu', m.revenue),
    ...revenueRows(m),
    l1('cogs', 'Chi phí', m.cogs),
    ...cogsRows(m),
    l1('gp', 'Lợi nhuận gộp', m.grossProfit),
    l1('opex', 'Chi phí vận hành', m.opexTotal),
    ...opexRows(m.opexItems),
    l1('net1', 'Lợi nhuận ròng (trước hoa hồng)', m.netBeforeCommission),
    l1('comm', 'Hoa hồng', round(m.commissionTotal + m.hhbhTotal)),
    // Dòng tỷ lệ lãi gộp ký gửi lưu theo %, đổi sang tỷ lệ để định dạng 0,00%
    ...m.commissionItems.map((i) =>
      i.categoryKey === RATE_KEY
        ? l2(`comm:${i.categoryKey}`, i.categoryName, i.amount / 100, PERCENT)
        : l2(`comm:${i.categoryKey}`, i.categoryName, i.amount),
    ),
    ...(m.hhbhTotal ? [l2('comm:hhbh', 'HHBH', m.hhbhTotal)] : []),
    l1('net2', 'Lợi nhuận ròng (sau hoa hồng)', m.netAfterCommission),
  ]);
}

export interface PnlCompareColumns {
  currentLabel: string;
  prevLabel: string;
  /** Dòng của tháng trước; thiếu tháng trước thì không có số (`undefined`). */
  prevRows?: PnlTableRow[];
}

/** Giá trị tháng trước của một dòng theo khóa; không có thì 0 hoặc trống theo `zeroIfMissing`. */
function prevValueOf(
  row: PnlTableRow,
  prevByKey: Map<string, PnlTableRow>,
): number | null {
  const prev = prevByKey.get(row.key);
  if (prev) return prev.value;
  return row.zeroIfMissing ? 0 : null;
}

/**
 * Ghi bảng ở cột A:C từ dòng 4: Danh mục | tháng này | tháng trước. Từng dòng thụt lề theo cấp.
 * Thiếu tháng trước (chỉ có một tháng dữ liệu) thì cột tháng trước để trống.
 */
export function writePnlTable(
  sheet: ExcelJS.Worksheet,
  rows: PnlTableRow[],
  compare: PnlCompareColumns,
): void {
  const prevByKey = new Map(
    (compare.prevRows ?? []).map((r) => [r.key, r] as const),
  );
  const header = sheet.getRow(4);
  ['Danh mục', compare.currentLabel, compare.prevLabel].forEach((text, i) => {
    const cell = header.getCell(i + 1);
    cell.value = text;
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = solid(HEADER_FILL);
    cell.alignment = {
      horizontal: i === 0 ? 'left' : 'right',
      vertical: 'middle',
      indent: 1,
    };
    cell.border = borderThin;
  });
  header.height = 22;

  rows.forEach((r, index) => {
    const excelRow = sheet.getRow(5 + index);
    const label = excelRow.getCell(1);
    const value = excelRow.getCell(2);
    const prevValue = excelRow.getCell(3);
    label.value = r.label;
    value.value = r.value;
    value.numFmt = r.numFmt;
    prevValue.value =
      compare.prevRows === undefined ? null : prevValueOf(r, prevByKey);
    prevValue.numFmt = r.numFmt;
    for (const cell of [label, value, prevValue]) {
      cell.font =
        r.level === 3
          ? {
              name: 'Calibri',
              size: 10,
              italic: true,
              color: { argb: DETAIL_COLOR },
            }
          : { name: 'Calibri', size: 11, bold: r.level === 1 };
      cell.border = borderThin;
      if (r.level === 1) cell.fill = solid(GROUP_FILL);
    }
    label.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      indent: r.level === 1 ? 1 : r.level === 2 ? 2 : 4,
    };
    for (const cell of [value, prevValue]) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });
}
