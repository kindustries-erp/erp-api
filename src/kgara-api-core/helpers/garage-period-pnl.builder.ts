import * as ExcelJS from 'exceljs';

import { writeDataTable } from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  CHART_PALETTE,
  LABEL_MONEY_FMT,
  LABEL_PERCENT_FMT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  bucketOpex,
  monthLabel,
  type PnlMonthRow,
} from './garage-pnl-month.helper';
import {
  buildPnlTableRows,
  writePnlTable,
} from './garage-period-pnl-table.helper';
import type { RevenueSeriesPoint } from './garage-period-series.helper';

export { buildPnlTableRows };

export const PNL_SHEET = 'Báo cáo lợi nhuận';

const MONEY = '#,##0';

const DATA_COL_WIDTH = 14;
const CHART_FIRST_COL = 4;
/** Chart xếp dọc ở cột D:M, bảng dữ liệu biểu đồ nằm dưới các chart. */
const CHART_LAST_COL = 13;
/** Mỗi chart cao 18 hàng; chart đầu bắt đầu ở hàng 3 (0-based). */
const CHART_FIRST_ROW = 3;
const CHART_HEIGHT_ROWS = 18;
const MIN_PRINT_ROWS = 20;

/** Chuỗi doanh thu, giá vốn theo ngày/tuần/tháng của kỳ báo cáo (chart đầu tiên). */
export interface PnlTimelineSeries {
  /** `ngày`, `tuần` hoặc `tháng`, ghép vào tiêu đề chart. */
  unitLabel: string;
  points: RevenueSeriesPoint[];
}

/** Tỷ lệ trên doanh thu; không có doanh thu thì `null` để đường % ngắt quãng. */
const ratioOrBlank = (part: number, revenue: number): number | null =>
  revenue > 0 ? part / revenue : null;

const ratio = (part: number, revenue: number) =>
  revenue > 0 ? part / revenue : 0;

type Row = (string | number | null)[];
type DataTable = ReturnType<typeof writeDataTable>;

const column = (rows: Row[], idx: number) =>
  rows.map((r) => (r[idx] === null ? null : Number(r[idx]) || 0));

const chartAnchor = (slot: number) => ({
  fromCol: CHART_FIRST_COL - 1,
  fromRow: CHART_FIRST_ROW + slot * CHART_HEIGHT_ROWS,
  toCol: CHART_LAST_COL,
  toRow: CHART_FIRST_ROW + (slot + 1) * CHART_HEIGHT_ROWS,
});

/** Chart combo: cột doanh thu / chi phí / lợi nhuận gộp + đường % lợi nhuận gộp trên trục phụ. */
function profitComboChart(
  title: string,
  slot: number,
  table: DataTable,
  labels: string[],
  rows: Row[],
  costName: string,
): XlsxChartSpec {
  return {
    type: 'combo',
    title,
    anchor: chartAnchor(slot),
    categoriesRef: table.ref(0),
    categories: labels,
    secondaryNumFmt: '0%',
    // Trục % bắt đầu từ 0 để đường không phóng đại chênh lệch nhỏ giữa các mốc
    secondaryMin: 0,
    dataLabels: true,
    labelNumFmt: LABEL_MONEY_FMT,
    labelFontSize: 700,
    series: [
      {
        name: 'Doanh thu',
        valuesRef: table.ref(1),
        values: column(rows, 1),
        color: CHART_PALETTE[0],
      },
      {
        name: costName,
        valuesRef: table.ref(2),
        values: column(rows, 2),
        color: CHART_PALETTE[1],
      },
      {
        name: 'Lợi nhuận gộp',
        valuesRef: table.ref(3),
        values: column(rows, 3),
        color: CHART_PALETTE[2],
      },
      {
        name: '% Lợi nhuận gộp',
        valuesRef: table.ref(4),
        values: column(rows, 4),
        color: CHART_PALETTE[5],
        kind: 'line',
        secondaryAxis: true,
        labelNumFmt: '0%',
      },
    ],
  };
}

/**
 * Sheet "Báo cáo lợi nhuận": bảng P&L 3 cấp của tháng cuối cùng trong `months` và các
 * chart: (nếu có `timeline`) doanh thu, giá vốn, lãi gộp theo ngày/tuần/tháng của kỳ báo
 * cáo; rồi 2 chart 12 tháng (doanh thu/chi phí/lợi nhuận gộp + % lợi nhuận gộp trên trục
 * phụ; tỷ trọng chi phí trên doanh thu dạng cột chồng). Trả về cấu hình chart để chèn
 * sau khi ghi buffer.
 */
export function buildPnlSheet(
  workbook: ExcelJS.Workbook,
  months: PnlMonthRow[],
  timeline?: PnlTimelineSeries,
): XlsxChartSpec[] {
  const sheet = workbook.addWorksheet(PNL_SHEET, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: 'FF475569' } },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.getColumn(1).width = 46;
  sheet.getColumn(2).width = 20;
  sheet.getColumn(3).width = 3;
  for (let c = CHART_FIRST_COL; c <= 26; c++)
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
    'Doanh thu, giá vốn theo ngày hoàn thành phiếu; chi phí vận hành, hoa hồng theo tháng. Chart đầu theo kỳ báo cáo (giá vốn chỉ gồm giá vốn từ phiếu), hai chart sau hiển thị 12 tháng gần nhất.';
  sheet.getCell('A2').font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF64748B' },
  };

  if (!current) return [];
  const tableRows = buildPnlTableRows(current);
  writePnlTable(sheet, tableRows);

  const showTimeline = Boolean(timeline && timeline.points.length > 0);
  const chartCount = showTimeline ? 3 : 2;
  const chartsEndRow = CHART_FIRST_ROW + chartCount * CHART_HEIGHT_ROWS;
  // Chỉ in bảng P&L và các chart, bỏ các bảng dữ liệu biểu đồ bên dưới
  sheet.pageSetup.printArea = `A1:M${Math.max(chartsEndRow + 2, 5 + tableRows.length)}`;
  const tableStartRow = chartsEndRow + 5;

  const labels = months.map(monthLabel);

  const trendRows = months.map(
    (m, i): Row => [
      labels[i],
      m.revenue,
      m.cogs,
      m.grossProfit,
      ratioOrBlank(m.grossProfit, m.revenue),
    ],
  );
  const trendTable = writeDataTable(sheet, {
    startRow: tableStartRow,
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
    startRow: tableStartRow,
    startCol: CHART_FIRST_COL + 6,
    title: 'Dữ liệu biểu đồ: Tỷ trọng chi phí trên doanh thu',
    headers: ['Tháng', ...ratioHeaders],
    rows: ratioRows,
    numFmts: [undefined, ...ratioHeaders.map(() => '0.0%')],
  });

  const charts: XlsxChartSpec[] = [];

  if (showTimeline && timeline) {
    const timelineRows = timeline.points.map(
      (p): Row => [
        p.label,
        p.revenue,
        p.cogs,
        p.revenue - p.cogs,
        ratioOrBlank(p.revenue - p.cogs, p.revenue),
      ],
    );
    const timelineTable = writeDataTable(sheet, {
      startRow: tableStartRow,
      startCol: CHART_FIRST_COL + 15,
      title: `Dữ liệu biểu đồ: Doanh thu - Giá vốn - Lãi gộp theo ${timeline.unitLabel}`,
      headers: [
        timeline.unitLabel === 'tháng' ? 'Tháng' : 'Mốc',
        'Doanh thu',
        'Giá vốn từ phiếu',
        'Lãi gộp',
        '% Lãi gộp',
      ],
      rows: timelineRows,
      numFmts: [undefined, MONEY, MONEY, MONEY, '0.0%'],
    });
    charts.push(
      profitComboChart(
        `Doanh thu, giá vốn, lãi gộp theo ${timeline.unitLabel}`,
        0,
        timelineTable,
        timeline.points.map((p) => p.label),
        timelineRows,
        'Giá vốn từ phiếu',
      ),
    );
  }

  charts.push(
    profitComboChart(
      'Báo cáo lợi nhuận',
      charts.length,
      trendTable,
      labels,
      trendRows,
      'Chi phí',
    ),
    {
      type: 'column',
      title: 'Tỷ trọng các chỉ số trên 100% doanh thu',
      anchor: chartAnchor(charts.length + 1),
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
  );
  return charts;
}
