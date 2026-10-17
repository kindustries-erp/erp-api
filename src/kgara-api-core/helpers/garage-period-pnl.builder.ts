import * as ExcelJS from 'exceljs';

import { writeDataTable } from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  CHART_PALETTE,
  LABEL_MONEY_FMT,
  LABEL_PERCENT_FMT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import { borderThin } from './kgara-excel-style.helper';
import {
  bucketOpex,
  monthLabel,
  type PnlMonthRow,
} from './garage-pnl-month.helper';

export const PNL_SHEET = 'Báo cáo lợi nhuận';

const MONEY = '#,##0';
const PERCENT = '0.00%';
const RATE_KEY = 'RATE_LAI_GOP_KY_GUI';

const HEADER_FILL = 'FF334155';
const GROUP_FILL = 'FFE2E8F0';
const DATA_COL_WIDTH = 14;
const CHART_FIRST_COL = 4;
/** Chart xếp dọc ở cột D:M, bảng dữ liệu biểu đồ nằm dưới màn hình đầu. */
const CHART_LAST_COL = 13;
const TABLE_START_ROW = 44;

interface PnlTableRow {
  label: string;
  value: number;
  group: boolean;
  numFmt: string;
}

const solid = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

/** Các dòng bảng "Báo cáo lợi nhuận" của một tháng (Danh mục, Giá trị). */
export function buildPnlTableRows(m: PnlMonthRow): PnlTableRow[] {
  const group = (label: string, value: number): PnlTableRow => ({
    label,
    value,
    group: true,
    numFmt: MONEY,
  });
  const item = (label: string, value: number, numFmt = MONEY): PnlTableRow => ({
    label,
    value,
    group: false,
    numFmt,
  });

  return [
    group('I. Doanh thu', m.revenue),
    item('Doanh thu', m.revenue),
    group('II. Chi phí', m.cogs),
    item('Chi phí phụ tùng ngoài & Gia công ngoài', m.cogs),
    group('III. Lợi nhuận gộp', m.grossProfit),
    group('IV. Chi phí vận hành', m.opexTotal),
    ...m.opexItems.map((i) => item(i.categoryName, i.amount)),
    group('V. Lợi nhuận ròng (trước hoa hồng)', m.netBeforeCommission),
    group('VI. Hoa hồng', m.commissionTotal),
    // Dòng tỷ lệ lãi gộp ký gửi lưu theo %, đổi sang tỷ lệ để định dạng 0,00%
    ...m.commissionItems.map((i) =>
      i.categoryKey === RATE_KEY
        ? item(i.categoryName, i.amount / 100, PERCENT)
        : item(i.categoryName, i.amount),
    ),
    group('VII. Lợi nhuận ròng (sau hoa hồng)', m.netAfterCommission),
  ];
}

function writePnlTable(sheet: ExcelJS.Worksheet, rows: PnlTableRow[]): void {
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

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(5 + index);
    const label = excelRow.getCell(1);
    const value = excelRow.getCell(2);
    label.value = row.label;
    value.value = row.value;
    value.numFmt = row.numFmt;
    for (const cell of [label, value]) {
      cell.font = { name: 'Calibri', size: 11, bold: row.group };
      cell.border = borderThin;
      if (row.group) cell.fill = solid(GROUP_FILL);
    }
    label.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      indent: row.group ? 1 : 2,
    };
    value.alignment = { horizontal: 'right', vertical: 'middle' };
  });
}

/** Tỷ lệ trên doanh thu; không có doanh thu thì `null` để đường % ngắt quãng. */
const ratioOrBlank = (part: number, revenue: number): number | null =>
  revenue > 0 ? part / revenue : null;

const ratio = (part: number, revenue: number) =>
  revenue > 0 ? part / revenue : 0;

/**
 * Sheet "Báo cáo lợi nhuận": bảng P&L của tháng cuối cùng trong `months` và 2 chart
 * 12 tháng (doanh thu/chi phí/lợi nhuận gộp + % lợi nhuận gộp trên trục phụ; tỷ trọng
 * chi phí trên doanh thu dạng cột chồng). Trả về cấu hình chart để chèn sau khi ghi buffer.
 */
export function buildPnlSheet(
  workbook: ExcelJS.Workbook,
  months: PnlMonthRow[],
): XlsxChartSpec[] {
  const sheet = workbook.addWorksheet(PNL_SHEET, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: 'FF475569' } },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      // Chỉ in bảng P&L và 2 chart, bỏ các bảng dữ liệu biểu đồ bên dưới
      printArea: 'A1:M41',
    },
  });
  sheet.getColumn(1).width = 46;
  sheet.getColumn(2).width = 20;
  sheet.getColumn(3).width = 3;
  for (let c = CHART_FIRST_COL; c <= 18; c++)
    sheet.getColumn(c).width = DATA_COL_WIDTH;

  const current = months[months.length - 1];
  const title = current
    ? `Báo cáo lợi nhuận - Tháng ${String(current.month).padStart(2, '0')}/${current.year}`
    : 'Báo cáo lợi nhuận';
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = {
    name: 'Calibri',
    size: 18,
    bold: true,
    color: { argb: 'FF0F172A' },
  };
  sheet.getRow(1).height = 30;
  sheet.getCell('A2').value =
    'Doanh thu, giá vốn theo ngày hoàn thành phiếu; chi phí vận hành, hoa hồng theo tháng. Chart hiển thị 12 tháng gần nhất.';
  sheet.getCell('A2').font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF64748B' },
  };

  if (!current) return [];
  writePnlTable(sheet, buildPnlTableRows(current));

  const labels = months.map(monthLabel);

  const trendRows = months.map((m, i): (string | number | null)[] => [
    labels[i],
    m.revenue,
    m.cogs,
    m.grossProfit,
    ratioOrBlank(m.grossProfit, m.revenue),
  ]);
  const trendTable = writeDataTable(sheet, {
    startRow: TABLE_START_ROW,
    startCol: CHART_FIRST_COL,
    title: 'Dữ liệu biểu đồ: Doanh thu - Chi phí - Lợi nhuận gộp',
    headers: [
      'Tháng',
      'Doanh thu',
      'Chi phí',
      'Lợi nhuận gộp',
      '% Lợi nhuận gộp',
    ],
    rows: trendRows,
    numFmts: [undefined, MONEY, MONEY, MONEY, '0.0%'],
  });

  const ratioHeaders = [
    'Chi phí phụ tùng / DT',
    'Nhân sự / DT',
    'Mặt bằng, điện nước / DT',
    'Vật tư tiêu hao / DT',
    'Bảo trì / DT',
    'Khấu hao / DT',
    'CP vận hành khác / DT',
  ];
  const ratioRows = months.map((m, i): (string | number)[] => {
    const b = bucketOpex(m.opexItems);
    return [
      labels[i],
      ratio(m.cogs, m.revenue),
      ratio(b.nhanSu, m.revenue),
      ratio(b.matBang, m.revenue),
      ratio(b.vatTu, m.revenue),
      ratio(b.baoTri, m.revenue),
      ratio(b.khauHao, m.revenue),
      ratio(b.khac, m.revenue),
    ];
  });
  const ratioTable = writeDataTable(sheet, {
    startRow: TABLE_START_ROW,
    startCol: CHART_FIRST_COL + 6,
    title: 'Dữ liệu biểu đồ: Tỷ trọng chi phí trên doanh thu',
    headers: ['Tháng', ...ratioHeaders],
    rows: ratioRows,
    numFmts: [undefined, ...ratioHeaders.map(() => '0.0%')],
  });

  const column = (rows: (string | number | null)[][], idx: number) =>
    rows.map((r) => (r[idx] === null ? null : Number(r[idx]) || 0));

  return [
    {
      type: 'combo',
      title: 'Báo cáo lợi nhuận',
      anchor: { fromCol: 3, fromRow: 3, toCol: CHART_LAST_COL, toRow: 21 },
      categoriesRef: trendTable.ref(0),
      categories: labels,
      secondaryNumFmt: '0%',
      // Trục % bắt đầu từ 0 để đường không phóng đại chênh lệch nhỏ giữa các tháng
      secondaryMin: 0,
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      labelFontSize: 700,
      series: [
        {
          name: 'Doanh thu',
          valuesRef: trendTable.ref(1),
          values: column(trendRows, 1),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Chi phí',
          valuesRef: trendTable.ref(2),
          values: column(trendRows, 2),
          color: CHART_PALETTE[1],
        },
        {
          name: 'Lợi nhuận gộp',
          valuesRef: trendTable.ref(3),
          values: column(trendRows, 3),
          color: CHART_PALETTE[2],
        },
        {
          name: '% Lợi nhuận gộp',
          valuesRef: trendTable.ref(4),
          values: column(trendRows, 4),
          color: CHART_PALETTE[5],
          kind: 'line',
          secondaryAxis: true,
          labelNumFmt: '0%',
        },
      ],
    },
    {
      type: 'column',
      title: 'Tỷ trọng các chỉ số trên 100% doanh thu',
      anchor: { fromCol: 3, fromRow: 21, toCol: CHART_LAST_COL, toRow: 39 },
      categoriesRef: ratioTable.ref(0),
      categories: labels,
      numFmt: '0%',
      stacked: true,
      dataLabels: true,
      labelNumFmt: LABEL_PERCENT_FMT,
      labelFontSize: 700,
      series: ratioHeaders.map((name, i) => ({
        name,
        valuesRef: ratioTable.ref(i + 1),
        values: column(ratioRows, i + 1),
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })),
    },
  ];
}
