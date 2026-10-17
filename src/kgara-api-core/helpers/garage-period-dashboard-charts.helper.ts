import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_DATA_START_COL,
  chartAnchor,
  writeDataTable,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  CHART_PALETTE,
  LABEL_MONEY_FMT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  BUCKET_UNIT_LABEL,
  buildCashflowSeries,
} from './garage-period-series.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import type { PeriodSummary } from './garage-period-summary.builder';

/** Chiều cao (số dòng) mỗi chart của Dashboard kỳ, thấp hơn mặc định để sheet gọn một màn hình. */
export const PERIOD_CHART_ROWS = 14;

const MONEY = '#,##0';
const COLUMN_WIDTHS = [34, 18, 18, 18, 18];
const AGING_LABELS = ['0-30 ngày', '31-60 ngày', '61-90 ngày', 'Trên 90 ngày'];

type Row = (string | number)[];

const column = (rows: Row[], idx: number) =>
  rows.map((r) => Number(r[idx]) || 0);

/** Chart không có điểm nào vẫn cần một dòng để vùng tham chiếu hợp lệ. */
const orEmpty = (rows: Row[], width: number): Row[] =>
  rows.length > 0 ? rows : [['Không có dữ liệu', ...Array(width - 1).fill(0)]];

/**
 * 2 chart của Dashboard: thu vs chi + dòng tiền ròng theo ngày/tuần/tháng, tuổi nợ phải thu
 * vs phải trả. Bảng dữ liệu chart xếp dọc ở vùng bên phải (ngoài vùng in A–P), bắt đầu từ `startRow`.
 */
export function buildDashboardCharts(
  sheet: ExcelJS.Worksheet,
  data: GaragePeriodReportData,
  summary: PeriodSummary,
  startRow: number,
): XlsxChartSpec[] {
  const col = DASHBOARD_DATA_START_COL;

  const cash = buildCashflowSeries(data);
  const cashUnit = BUCKET_UNIT_LABEL[cash.unit];
  const cashRows = orEmpty(
    cash.points.map((p): Row => [p.label, p.thu, p.chi, p.thu - p.chi]),
    4,
  );
  const cashTable = writeDataTable(sheet, {
    startRow,
    startCol: col,
    columnWidths: COLUMN_WIDTHS,
    title: `Dữ liệu biểu đồ: Thu vs chi theo ${cashUnit}`,
    headers: ['Mốc thời gian', 'Thu', 'Chi', 'Dòng tiền ròng'],
    rows: cashRows,
    numFmts: [undefined, MONEY, MONEY, MONEY],
  });

  const agingRows: Row[] = [
    [AGING_LABELS[0], summary.receivable.b0_30, summary.payable.b0_30],
    [AGING_LABELS[1], summary.receivable.b31_60, summary.payable.b31_60],
    [AGING_LABELS[2], summary.receivable.b61_90, summary.payable.b61_90],
    [AGING_LABELS[3], summary.receivable.over90, summary.payable.over90],
  ];
  const agingTable = writeDataTable(sheet, {
    startRow: cashTable.nextRow,
    startCol: col,
    columnWidths: COLUMN_WIDTHS,
    title: 'Dữ liệu biểu đồ: Tuổi nợ phải thu vs phải trả',
    headers: ['Khoảng tuổi nợ', 'Phải thu', 'Phải trả'],
    rows: agingRows,
    numFmts: [undefined, MONEY, MONEY],
  });

  return [
    {
      type: 'combo',
      title: `Thu vs chi theo ${cashUnit}`,
      anchor: chartAnchor(startRow, 0, { rows: PERIOD_CHART_ROWS }),
      categoriesRef: cashTable.ref(0),
      categories: cashRows.map((r) => String(r[0])),
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      labelFontSize: 700,
      series: [
        {
          name: 'Thu',
          valuesRef: cashTable.ref(1),
          values: column(cashRows, 1),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Chi',
          valuesRef: cashTable.ref(2),
          values: column(cashRows, 2),
          color: CHART_PALETTE[3],
        },
        {
          name: 'Dòng tiền ròng',
          valuesRef: cashTable.ref(3),
          values: column(cashRows, 3),
          color: CHART_PALETTE[2],
          kind: 'line',
          dataLabels: false,
        },
      ],
    },
    {
      type: 'column',
      title: 'Tuổi nợ phải thu vs phải trả',
      anchor: chartAnchor(startRow, 1, { rows: PERIOD_CHART_ROWS }),
      categoriesRef: agingTable.ref(0),
      categories: AGING_LABELS,
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      series: [
        {
          name: 'Phải thu',
          valuesRef: agingTable.ref(1),
          values: column(agingRows, 1),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Phải trả',
          valuesRef: agingTable.ref(2),
          values: column(agingRows, 2),
          color: CHART_PALETTE[1],
        },
      ],
    },
  ];
}
