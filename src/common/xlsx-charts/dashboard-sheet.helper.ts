import * as ExcelJS from 'exceljs';

import type { XlsxChartAnchor } from './xlsx-chart.types';

/** Dashboard rộng 16 cột (A–P): KPI 4 thẻ × 4 cột, chart 2 cột × 8 cột. */
export const DASHBOARD_COLUMNS = 16;
const CARD_COLS = 4;
const CARDS_PER_ROW = DASHBOARD_COLUMNS / CARD_COLS;
const CHART_COLS = DASHBOARD_COLUMNS / 2;
export const DASHBOARD_CHART_ROWS = 16;
/** Cột (1-based) đầu tiên của vùng "Dữ liệu biểu đồ": bên phải vùng in (A–P). */
export const DASHBOARD_DATA_START_COL = DASHBOARD_COLUMNS + 2;

const COLOR_TITLE = 'FF0F172A';
const COLOR_MUTED = 'FF64748B';
const COLOR_CARD_FILL = 'FFF8FAFC';
const COLOR_HEADER_FILL = 'FF334155';
const BORDER_COLOR = { argb: 'FFE2E8F0' };

export type DashboardKpiValue = number | { formula: string; result: number };

export interface DashboardKpi {
  label: string;
  value: DashboardKpiValue;
  numFmt?: string;
}

export interface DashboardDataTable {
  /** Dòng (1-based) bắt đầu của bảng (dòng tiêu đề bảng). */
  startRow: number;
  /** Cột (1-based) bắt đầu. */
  startCol: number;
  title: string;
  headers: string[];
  rows: (string | number)[][];
  numFmts?: (string | undefined)[];
  /** Độ rộng từng cột của bảng (đặt lên sheet). */
  columnWidths?: number[];
}

export interface DashboardDataRefs {
  firstDataRow: number;
  lastDataRow: number;
  /** Dòng ngay sau bảng (dùng đặt bảng kế tiếp). */
  nextRow: number;
  /** `$B$20:$B$29` cho cột thứ `index` (0-based) của bảng. */
  ref: (index: number) => string;
}

export function columnLetter(colIndex: number): string {
  let n = colIndex;
  let out = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    out = String.fromCharCode(65 + mod) + out;
    n = Math.floor((n - mod) / 26);
  }
  return out;
}

export const absRef = (col: number, row1: number, row2: number) =>
  `$${columnLetter(col)}$${row1}:$${columnLetter(col)}$${row2}`;

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: BORDER_COLOR },
  bottom: { style: 'thin', color: BORDER_COLOR },
  left: { style: 'thin', color: BORDER_COLOR },
  right: { style: 'thin', color: BORDER_COLOR },
};

const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

/** Tạo sheet Dashboard (phải gọi TRƯỚC khi tạo các sheet khác để nằm đầu file). */
export function createDashboardSheet(
  workbook: ExcelJS.Workbook,
  name: string,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: 'FF059669' } },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  for (let c = 1; c <= DASHBOARD_COLUMNS; c++) sheet.getColumn(c).width = 13;
  return sheet;
}

/** Tiêu đề + các dòng phụ (kỳ, chi nhánh...). Trả về dòng trống kế tiếp. */
export function writeDashboardHeader(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitleLines: string[],
): number {
  sheet.mergeCells(1, 1, 1, DASHBOARD_COLUMNS);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: 'Calibri',
    size: 18,
    bold: true,
    color: { argb: COLOR_TITLE },
  };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 30;

  let row = 2;
  for (const line of subtitleLines) {
    sheet.mergeCells(row, 1, row, DASHBOARD_COLUMNS);
    const cell = sheet.getCell(row, 1);
    cell.value = line;
    cell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: COLOR_MUTED },
    };
    row++;
  }
  return row + 1;
}

/** Vẽ các thẻ KPI (4 thẻ/hàng, mỗi thẻ 2 dòng: nhãn + giá trị). Trả về dòng trống kế tiếp. */
export function writeKpiCards(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  kpis: DashboardKpi[],
): number {
  let row = startRow;
  for (let i = 0; i < kpis.length; i += CARDS_PER_ROW) {
    kpis.slice(i, i + CARDS_PER_ROW).forEach((kpi, slot) => {
      const col = slot * CARD_COLS + 1;
      const last = col + CARD_COLS - 1;

      sheet.mergeCells(row, col, row, last);
      sheet.mergeCells(row + 1, col, row + 1, last);

      const label = sheet.getCell(row, col);
      label.value = kpi.label;
      label.font = {
        name: 'Calibri',
        size: 9,
        bold: true,
        color: { argb: COLOR_MUTED },
      };
      label.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      const value = sheet.getCell(row + 1, col);
      value.value = kpi.value;
      value.numFmt = kpi.numFmt ?? '#,##0';
      value.font = {
        name: 'Calibri',
        size: 16,
        bold: true,
        color: { argb: COLOR_TITLE },
      };
      value.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

      for (let c = col; c <= last; c++) {
        for (const r of [row, row + 1]) {
          const cell = sheet.getCell(r, c);
          cell.fill = fill(COLOR_CARD_FILL);
          cell.border = {
            top: r === row ? thinBorder.top : undefined,
            bottom: r === row + 1 ? thinBorder.bottom : undefined,
            left: c === col ? thinBorder.left : undefined,
            right: c === last ? thinBorder.right : undefined,
          };
        }
      }
    });
    sheet.getRow(row).height = 18;
    sheet.getRow(row + 1).height = 28;
    row += 3;
  }
  return row;
}

/**
 * Vị trí chart theo "ô lưới": 2 chart mỗi hàng (trái/phải). `slot` 0,1 ở hàng đầu,
 * 2,3 ở hàng kế... `startRow` là dòng 1-based của hàng chart đầu tiên.
 */
export function chartAnchor(
  startRow: number,
  slot: number,
  options: { fullWidth?: boolean } = {},
): XlsxChartAnchor {
  const gridRow = Math.floor(slot / 2);
  const fromRow = startRow - 1 + gridRow * (DASHBOARD_CHART_ROWS + 1);
  const left = slot % 2 === 0;
  if (options.fullWidth) {
    return {
      fromCol: 0,
      fromRow,
      toCol: DASHBOARD_COLUMNS,
      toRow: fromRow + DASHBOARD_CHART_ROWS,
    };
  }
  return {
    fromCol: left ? 0 : CHART_COLS,
    fromRow,
    toCol: left ? CHART_COLS : DASHBOARD_COLUMNS,
    toRow: fromRow + DASHBOARD_CHART_ROWS,
  };
}

/** Giới hạn vùng in trong A–P (không in khối dữ liệu biểu đồ). */
export function setDashboardPrintArea(
  sheet: ExcelJS.Worksheet,
  lastRow: number,
): void {
  sheet.pageSetup.printArea = `A1:${columnLetter(DASHBOARD_COLUMNS)}${lastRow}`;
}

/** Dòng 1-based nằm ngay dưới `rowsOfCharts` hàng chart bắt đầu từ `startRow`. */
export const rowAfterCharts = (startRow: number, rowsOfCharts: number) =>
  startRow + rowsOfCharts * (DASHBOARD_CHART_ROWS + 1) + 1;

/** Bảng "Dữ liệu biểu đồ": tiêu đề, header và các dòng; trả về tham chiếu từng cột. */
export function writeDataTable(
  sheet: ExcelJS.Worksheet,
  table: DashboardDataTable,
): DashboardDataRefs {
  const { startRow, startCol, headers, rows } = table;
  table.columnWidths?.forEach((width, i) => {
    sheet.getColumn(startCol + i).width = width;
  });

  const titleCell = sheet.getCell(startRow, startCol);
  titleCell.value = table.title;
  titleCell.font = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: COLOR_TITLE },
  };

  const headerRow = startRow + 1;
  headers.forEach((header, i) => {
    const cell = sheet.getCell(headerRow, startCol + i);
    cell.value = header;
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = fill(COLOR_HEADER_FILL);
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = thinBorder;
  });

  rows.forEach((values, r) => {
    values.forEach((value, i) => {
      const cell = sheet.getCell(headerRow + 1 + r, startCol + i);
      cell.value = value;
      cell.border = thinBorder;
      const fmt = table.numFmts?.[i];
      if (fmt) cell.numFmt = fmt;
      if (typeof value === 'number') cell.alignment = { horizontal: 'right' };
    });
  });

  const firstDataRow = headerRow + 1;
  const lastDataRow = headerRow + Math.max(rows.length, 1);
  return {
    firstDataRow,
    lastDataRow,
    nextRow: lastDataRow + 2,
    ref: (index: number) => absRef(startCol + index, firstDataRow, lastDataRow),
  };
}
