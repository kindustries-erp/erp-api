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

/** Cấp 1: nhóm I-VII; cấp 2: hạng mục; cấp 3: chi tiết (phân loại, dòng nhập). */
export type PnlLevel = 1 | 2 | 3;

export interface PnlTableRow {
  label: string;
  value: number;
  level: PnlLevel;
  numFmt: string;
}

const solid = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

const row =
  (level: PnlLevel) =>
  (label: string, value: number, numFmt = MONEY): PnlTableRow => ({
    label,
    value,
    level,
    numFmt,
  });

const l1 = row(1);
const l2 = row(2);
const l3 = row(3);

const round = (value: number) => Math.round(value);

/** Chi phí vận hành: hạng mục (cấp 2, cộng các dòng cùng khóa) và từng dòng nhập (cấp 3). */
function opexRows(items: PnlLineItem[]): PnlTableRow[] {
  const groups = new Map<string, PnlLineItem[]>();
  for (const item of items) {
    const key = item.categoryKey || item.categoryName;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].flatMap((entries) => {
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const showEntries = entries.length > 1 || entries.some((e) => e.note);
    return [
      l2(entries[0].categoryName, total),
      ...(showEntries
        ? entries.map((e) => l3(e.note || 'Khoản chi', e.amount))
        : []),
    ];
  });
}

/** Doanh thu theo phân loại (cấp 2) kèm số phiếu (cấp 3); thiếu phân loại thì một dòng như cũ. */
function revenueRows(m: PnlMonthRow): PnlTableRow[] {
  const segments = m.revenueSegments.filter((s) => s.revenue || s.caseCount);
  if (segments.length === 0) return [l2('Doanh thu', m.revenue)];
  return segments.flatMap((s) => [
    l2(s.label, s.revenue),
    l3('Số phiếu hoàn thành', s.caseCount, COUNT),
  ]);
}

/** Giá vốn từ phiếu theo phân loại và điều chỉnh giá vốn nhập tay; thiếu chi tiết thì một dòng như cũ. */
function cogsRows(m: PnlMonthRow): PnlTableRow[] {
  const segments = m.revenueSegments.filter((s) => s.cogs);
  const adjustments = m.cogsAdjustmentItems;
  if (segments.length === 0 && adjustments.length === 0) {
    return [l2('Chi phí phụ tùng ngoài & Gia công ngoài', m.cogs)];
  }
  const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
  return [
    l2('Giá vốn từ phiếu (phụ tùng ngoài & gia công ngoài)', m.cogsDirect),
    ...segments.map((s) => l3(s.label, s.cogs)),
    ...(adjustments.length > 0
      ? [
          l2('Điều chỉnh giá vốn nhập tay', adjustmentTotal),
          ...adjustments.map((a) =>
            l3(
              a.note ? `${a.categoryName} - ${a.note}` : a.categoryName,
              a.amount,
            ),
          ),
        ]
      : []),
  ];
}

/**
 * Các dòng bảng "Báo cáo lợi nhuận" của một tháng (Danh mục, Giá trị), 3 cấp.
 * Nhóm VI gồm cả HHBH để V − VI = VII luôn đúng.
 */
export function buildPnlTableRows(m: PnlMonthRow): PnlTableRow[] {
  return [
    l1('I. Doanh thu', m.revenue),
    ...revenueRows(m),
    l1('II. Chi phí', m.cogs),
    ...cogsRows(m),
    l1('III. Lợi nhuận gộp', m.grossProfit),
    l1('IV. Chi phí vận hành', m.opexTotal),
    ...opexRows(m.opexItems),
    l1('V. Lợi nhuận ròng (trước hoa hồng)', m.netBeforeCommission),
    l1('VI. Hoa hồng', round(m.commissionTotal + m.hhbhTotal)),
    // Dòng tỷ lệ lãi gộp ký gửi lưu theo %, đổi sang tỷ lệ để định dạng 0,00%
    ...m.commissionItems.map((i) =>
      i.categoryKey === RATE_KEY
        ? l2(i.categoryName, i.amount / 100, PERCENT)
        : l2(i.categoryName, i.amount),
    ),
    ...(m.hhbhTotal ? [l2('HHBH', m.hhbhTotal)] : []),
    l1('VII. Lợi nhuận ròng (sau hoa hồng)', m.netAfterCommission),
  ];
}

/** Ghi bảng ở cột A:B từ dòng 4: tiêu đề, rồi từng dòng thụt lề theo cấp. */
export function writePnlTable(
  sheet: ExcelJS.Worksheet,
  rows: PnlTableRow[],
): void {
  const header = sheet.getRow(4);
  ['Danh mục', 'Giá trị'].forEach((text, i) => {
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
    label.value = r.label;
    value.value = r.value;
    value.numFmt = r.numFmt;
    for (const cell of [label, value]) {
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
    value.alignment = { horizontal: 'right', vertical: 'middle' };
  });
}
