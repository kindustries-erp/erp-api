import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_DATA_START_COL,
  chartAnchor,
  columnLetter,
  rowAfterCharts,
  setDashboardPrintArea,
  writeDashboardHeader,
  writeDataTable,
  writeKpiCards,
  type DashboardKpi,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  CHART_PALETTE,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  buildTimeSeries,
  chooseBucketUnit,
  classificationBreakdown,
  pickBasisDate,
  spanInDays,
  topCustomersByRevenue,
  type BucketUnit,
  type DateBasis,
} from './garage-cases-dashboard-data.helper';
import { COMPLETED_CASES_COLUMNS } from './kgara-excel-style.helper';
import {
  SHEET1_FIRST_DATA_ROW,
  SHEET1_NAME,
  type Sheet1Summary,
} from './kgara-completed-cases-sheet.builder';

export const CASES_DASHBOARD_SHEET = 'Dashboard';
const MONEY = '#,##0';
const TOP_N = 10;

export interface CasesDashboardMeta {
  /** `YYYY-MM-DD` hoặc ISO; thiếu thì hiển thị "Tất cả". */
  dateFrom?: string;
  dateTo?: string;
  branchLabel?: string;
  modeLabel?: string;
  /** Ngày dùng xếp phiếu vào kỳ trên biểu đồ theo thời gian. */
  dateBasis: DateBasis;
}

const BUCKET_LABEL: Record<BucketUnit, string> = {
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
};

const BASIS_LABEL: Record<DateBasis, string> = {
  completion: 'ngày kết thúc',
  received: 'ngày tiếp nhận',
  issued: 'ngày phát sinh',
};

const displayDay = (v?: string) => {
  if (!v) return '';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Dựng sheet Dashboard cho báo cáo phiếu dịch vụ. KPI là công thức tham chiếu
 * Sheet 1 (cùng nguồn số liệu); các bảng dữ liệu biểu đồ nằm bên phải vùng in.
 */
export function buildCasesDashboard(
  dashboard: ExcelJS.Worksheet,
  summary: Sheet1Summary,
  meta: CasesDashboardMeta,
): XlsxChartSpec[] {
  const { rows, sums } = summary;
  const sheetRef = `'${SHEET1_NAME}'`;
  const lastRow = SHEET1_FIRST_DATA_ROW + Math.max(rows.length, 1) - 1;
  const col = (key: string) => {
    const letter = columnLetter(
      COMPLETED_CASES_COLUMNS.findIndex((c) => c.key === key) + 1,
    );
    return `${sheetRef}!${letter}${SHEET1_FIRST_DATA_ROW}:${letter}${lastRow}`;
  };

  const revenue = sums.doanhThu ?? 0;
  const profit = sums.loiNhuan ?? 0;
  const kpis: DashboardKpi[] = [
    { label: 'SỐ PHIẾU DỊCH VỤ', value: rows.length },
    {
      label: 'DOANH THU',
      value: { formula: `SUM(${col('doanhThu')})`, result: revenue },
    },
    {
      label: 'CHI PHÍ',
      value: { formula: `SUM(${col('chiPhi')})`, result: sums.chiPhi ?? 0 },
    },
    {
      label: 'LỢI NHUẬN',
      value: { formula: `SUM(${col('loiNhuan')})`, result: profit },
    },
    {
      label: 'BIÊN LỢI NHUẬN',
      value: {
        formula: `IF(SUM(${col('doanhThu')})>0,SUM(${col('loiNhuan')})/SUM(${col('doanhThu')}),0)`,
        result: revenue > 0 ? profit / revenue : 0,
      },
      numFmt: '0.0%',
    },
    {
      label: 'ĐÃ THU',
      value: { formula: `SUM(${col('daThu')})`, result: sums.daThu ?? 0 },
    },
    {
      label: 'CÒN PHẢI THU',
      value: {
        formula: `SUM(${col('conPhaiThu')})`,
        result: sums.conPhaiThu ?? 0,
      },
    },
    {
      label: 'CÒN PHẢI TRẢ',
      value: {
        formula: `SUM(${col('conPhaiTra')})`,
        result: sums.conPhaiTra ?? 0,
      },
    },
  ];

  const period =
    meta.dateFrom || meta.dateTo
      ? `Kỳ: ${displayDay(meta.dateFrom) || '...'} - ${displayDay(meta.dateTo) || '...'}`
      : 'Kỳ: Tất cả';
  const nextRow = writeDashboardHeader(
    dashboard,
    'Dashboard bảng kê phiếu dịch vụ',
    [
      period,
      `Chi nhánh: ${meta.branchLabel || 'Tất cả chi nhánh'}`,
      ...(meta.modeLabel ? [`Chế độ: ${meta.modeLabel}`] : []),
    ],
  );
  const chartsRow = writeKpiCards(dashboard, nextRow, kpis);
  setDashboardPrintArea(dashboard, rowAfterCharts(chartsRow, 2));

  if (rows.length === 0) return [];

  const dates = rows
    .map((r) => pickBasisDate(r, meta.dateBasis))
    .filter((d): d is Date => d !== null);
  const unit = chooseBucketUnit(spanInDays(meta.dateFrom, meta.dateTo, dates));
  const series = buildTimeSeries(rows, meta.dateBasis, unit);
  const classes = classificationBreakdown(rows);
  const customers = topCustomersByRevenue(rows, TOP_N);

  const tsCol = DASHBOARD_DATA_START_COL;
  const classCol = tsCol + 5;
  const topCol = classCol + 3;
  const tsTable = writeDataTable(dashboard, {
    startRow: chartsRow,
    startCol: tsCol,
    columnWidths: [16, 16, 16, 16],
    title: `Dữ liệu biểu đồ: Theo ${BUCKET_LABEL[unit]}`,
    headers: ['Kỳ', 'Doanh thu', 'Chi phí', 'Lợi nhuận'],
    rows: series.map((p) => [p.label, p.revenue, p.cost, p.profit]),
    numFmts: [undefined, MONEY, MONEY, MONEY],
  });
  const classTable = writeDataTable(dashboard, {
    startRow: chartsRow,
    startCol: classCol,
    columnWidths: [22, 16],
    title: 'Dữ liệu biểu đồ: Doanh thu theo phân loại',
    headers: ['Phân loại', 'Doanh thu'],
    rows: classes.map((c) => [c.label, c.revenue]),
    numFmts: [undefined, MONEY],
  });
  const topTable = writeDataTable(dashboard, {
    startRow: chartsRow,
    startCol: topCol,
    columnWidths: [36, 16, 16],
    title: `Dữ liệu biểu đồ: Top ${TOP_N} khách hàng`,
    headers: ['Khách hàng', 'Doanh thu', 'Lợi nhuận'],
    rows: customers.map((c) => [c.label, c.revenue, c.profit]),
    numFmts: [undefined, MONEY, MONEY],
  });

  const charts: XlsxChartSpec[] = [];

  if (series.length > 0) {
    charts.push({
      type: 'combo',
      title: `Doanh thu - Chi phí - Lợi nhuận theo ${BUCKET_LABEL[unit]} (${BASIS_LABEL[meta.dateBasis]})`,
      anchor: chartAnchor(chartsRow, 0, { fullWidth: true }),
      categoriesRef: tsTable.ref(0),
      categories: series.map((p) => p.label),
      series: [
        {
          name: 'Doanh thu',
          valuesRef: tsTable.ref(1),
          values: series.map((p) => p.revenue),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Chi phí',
          valuesRef: tsTable.ref(2),
          values: series.map((p) => p.cost),
          color: CHART_PALETTE[1],
        },
        {
          name: 'Lợi nhuận',
          valuesRef: tsTable.ref(3),
          values: series.map((p) => p.profit),
          color: CHART_PALETTE[3],
          kind: 'line',
        },
      ],
    });
  }

  if (classes.length > 0) {
    charts.push({
      type: 'doughnut',
      title: 'Cơ cấu doanh thu theo phân loại',
      anchor: chartAnchor(chartsRow, 2),
      categoriesRef: classTable.ref(0),
      categories: classes.map((c) => c.label),
      series: [
        {
          name: 'Doanh thu',
          valuesRef: classTable.ref(1),
          values: classes.map((c) => c.revenue),
          color: CHART_PALETTE[0],
        },
      ],
    });
  }

  if (customers.length > 0) {
    charts.push({
      type: 'bar',
      title: `Top ${TOP_N} khách hàng theo doanh thu`,
      anchor: chartAnchor(chartsRow, 3),
      categoriesRef: topTable.ref(0),
      categories: customers.map((c) => c.label),
      series: [
        {
          name: 'Doanh thu',
          valuesRef: topTable.ref(1),
          values: customers.map((c) => c.revenue),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Lợi nhuận',
          valuesRef: topTable.ref(2),
          values: customers.map((c) => c.profit),
          color: CHART_PALETTE[3],
        },
      ],
      reverseCategories: true,
    });
  }

  return charts;
}
