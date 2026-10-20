import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_COLUMNS,
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
  CHART_TINT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  buildCashSeries,
  buildTimeSeries,
  chooseBucketUnit,
  classificationBreakdown,
  pickBasisDate,
  spanInDays,
  topCustomersByRevenue,
  type BucketUnit,
  type DateBasis,
} from './garage-cases-dashboard-data.helper';
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
  const { rows, sums, columns } = summary;
  const sheetRef = `'${SHEET1_NAME}'`;
  const lastRow = SHEET1_FIRST_DATA_ROW + Math.max(rows.length, 1) - 1;
  /** Vùng dữ liệu cột trên Sheet 1; null nếu cột không được chọn khi xuất. */
  const colRange = (key: string): string | null => {
    const idx = columns.findIndex((c) => c.key === key);
    if (idx < 0) return null;
    const letter = columnLetter(idx + 1);
    return `${sheetRef}!${letter}${SHEET1_FIRST_DATA_ROW}:${letter}${lastRow}`;
  };
  /** KPI SUM tham chiếu Sheet 1; thiếu cột thì giữ giá trị tính sẵn. */
  const sumKpi = (key: string, result: number) => {
    const range = colRange(key);
    return range ? { formula: `SUM(${range})`, result } : result;
  };

  const revenue = sums.doanhThu ?? 0;
  const profit = sums.loiNhuan ?? 0;
  const revenueRange = colRange('doanhThu');
  const profitRange = colRange('loiNhuan');
  const marginKpi =
    revenueRange && profitRange
      ? {
          formula: `IF(SUM(${revenueRange})>0,SUM(${profitRange})/SUM(${revenueRange}),0)`,
          result: revenue > 0 ? profit / revenue : 0,
        }
      : revenue > 0
        ? profit / revenue
        : 0;
  const kpis: DashboardKpi[] = [
    { label: 'SỐ PHIẾU DỊCH VỤ', value: rows.length },
    { label: 'DOANH THU', value: sumKpi('doanhThu', revenue) },
    { label: 'CHI PHÍ', value: sumKpi('chiPhi', sums.chiPhi ?? 0) },
    { label: 'LỢI NHUẬN', value: sumKpi('loiNhuan', profit) },
    {
      label: 'BIÊN LỢI NHUẬN',
      value: marginKpi,
      numFmt: '0.0%',
    },
    { label: 'ĐÃ THU', value: sumKpi('daThu', sums.daThu ?? 0) },
    { label: 'DỰ THU', value: sumKpi('duThu', sums.duThu ?? 0) },
    {
      label: 'CÒN PHẢI THU',
      value: sumKpi('conPhaiThu', sums.conPhaiThu ?? 0),
    },
    {
      label: 'CÒN PHẢI TRẢ',
      value: sumKpi('conPhaiTra', sums.conPhaiTra ?? 0),
    },
    { label: 'DỰ CHI', value: sumKpi('duChi', sums.duChi ?? 0) },
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
  // 3 hàng chart: thu chi (full), phân loại + top khách, dòng tiền thực tế và dự kiến (full)
  const footnoteRow = rowAfterCharts(chartsRow, 3);
  setDashboardPrintArea(dashboard, footnoteRow);

  if (rows.length === 0) return [];

  const dates = rows
    .map((r) => pickBasisDate(r, meta.dateBasis))
    .filter((d): d is Date => d !== null);
  const unit = chooseBucketUnit(spanInDays(meta.dateFrom, meta.dateTo, dates));
  const series = buildTimeSeries(rows, meta.dateBasis, unit);
  const cashSeries = buildCashSeries(rows, meta.dateBasis, unit);
  const classes = classificationBreakdown(rows);
  const customers = topCustomersByRevenue(rows, TOP_N);

  const tsCol = DASHBOARD_DATA_START_COL;
  const classCol = tsCol + 5;
  const topCol = classCol + 3;
  const cashCol = topCol + 4;
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

  const cashTable = writeDataTable(dashboard, {
    startRow: chartsRow,
    startCol: cashCol,
    columnWidths: [16, 16, 16, 16, 16],
    title: `Dữ liệu biểu đồ: Dòng tiền theo ${BUCKET_LABEL[unit]}`,
    headers: ['Kỳ', 'Đã thu', 'Dự thu', 'Đã trả', 'Dự chi'],
    rows: cashSeries.map((p) => [
      p.label,
      p.received,
      p.expected,
      p.paid,
      p.planned,
    ]),
    numFmts: [undefined, MONEY, MONEY, MONEY, MONEY],
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

  if (cashSeries.length > 0) {
    charts.push({
      type: 'column',
      title: `Đã thu - Dự thu - Đã trả - Dự chi theo ${BUCKET_LABEL[unit]} (${BASIS_LABEL[meta.dateBasis]})`,
      anchor: chartAnchor(chartsRow, 4, { fullWidth: true }),
      categoriesRef: cashTable.ref(0),
      categories: cashSeries.map((p) => p.label),
      series: [
        {
          name: 'Đã thu',
          valuesRef: cashTable.ref(1),
          values: cashSeries.map((p) => p.received),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Dự thu',
          valuesRef: cashTable.ref(2),
          values: cashSeries.map((p) => p.expected),
          color: CHART_TINT.emerald,
        },
        {
          name: 'Đã trả',
          valuesRef: cashTable.ref(3),
          values: cashSeries.map((p) => p.paid),
          color: CHART_PALETTE[3],
        },
        {
          name: 'Dự chi',
          valuesRef: cashTable.ref(4),
          values: cashSeries.map((p) => p.planned),
          color: CHART_TINT.rose,
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

  writeCasesFootnote(
    dashboard,
    footnoteRow,
    'Đã thu/đã trả lấy từ thu chi gắn phiếu dịch vụ (settlement). Dự thu là phiếu thu dự kiến chưa thu; dự chi là phiếu chi Chờ duyệt + Đã duyệt gắn phiếu dịch vụ; phiếu đã hủy không tính. Các số này tính theo tập phiếu dịch vụ trong bảng kê nên có thể khác báo cáo kỳ (theo ngày chứng từ thu chi).',
  );

  return charts;
}

/** Ghi chú nguồn số liệu một dòng cuối Dashboard bảng kê. */
function writeCasesFootnote(
  sheet: ExcelJS.Worksheet,
  row: number,
  text: string,
): void {
  sheet.mergeCells(row, 1, row, DASHBOARD_COLUMNS);
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  cell.font = {
    name: 'Calibri',
    size: 9,
    italic: true,
    color: { argb: 'FF64748B' },
  };
  cell.alignment = { vertical: 'top', wrapText: true };
  sheet.getRow(row).height = 36;
}
