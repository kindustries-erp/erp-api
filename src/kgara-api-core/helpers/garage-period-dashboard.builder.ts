import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_CHART_ROWS,
  DASHBOARD_COLUMNS,
  DASHBOARD_DATA_START_COL,
  chartAnchorRow,
  rowAfterCharts,
  setDashboardPrintArea,
  writeAlertCards,
  writeDashboardHeader,
  writeDataTable,
  writeKpiCards,
  type DashboardKpi,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  CHART_PALETTE,
  LABEL_MONEY_FMT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import { formatPeriod } from './garage-debts-export.helper';
import {
  buildOverdueCards,
  summarizeOverdue,
} from './garage-overdue-warning.helper';
import { bucketCashflow } from './garage-period-cashflow-bucket.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';

const MONEY = '#,##0';
const AGING_LABELS = ['0-30 ngày', '31-60 ngày', '61-90 ngày', 'Trên 90 ngày'];
/** Chiều cao 3 dòng card cảnh báo (nhãn, giá trị, ghi chú) để cả khối chỉ ~ 8 hàng. */
const ALERT_HEIGHTS: [number, number, number] = [14, 22, 24];

const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0);

/** Ghi chú nguồn số liệu một dòng ở cuối sheet. */
function writeFootnote(
  sheet: ExcelJS.Worksheet,
  row: number,
  text: string,
): number {
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
  sheet.getRow(row).height = 28;
  return row;
}

/**
 * Dashboard thu chi & công nợ gọn một màn hình: 8 card cảnh báo quá hạn (phải thu,
 * phải trả), 4 KPI và 3 chart có nhãn số. Doanh thu, giá vốn, lãi gộp nằm ở sheet
 * "Báo cáo lợi nhuận". Trả về cấu hình chart để chèn sau khi ghi buffer.
 */
export function buildPeriodDashboard(
  dashboard: ExcelJS.Worksheet,
  data: GaragePeriodReportData,
): XlsxChartSpec[] {
  const receivable = summarizeOverdue('receivable', data.openCustomerRows);
  const payable = summarizeOverdue('payable', data.openSupplierRows);

  const headerEnd = writeDashboardHeader(
    dashboard,
    'Dashboard thu chi & công nợ Garage',
    [
      `${formatPeriod({
        dateFrom: data.from,
        dateTo: data.to,
        asOfDate: data.asOfDate,
      })} · Chi nhánh: ${data.branchLabel || 'Tất cả chi nhánh'}`,
    ],
  );
  const receivableEnd = writeAlertCards(
    dashboard,
    headerEnd,
    buildOverdueCards(receivable),
    { heights: ALERT_HEIGHTS },
  );
  const kpiStart = writeAlertCards(
    dashboard,
    receivableEnd,
    buildOverdueCards(payable),
    { heights: ALERT_HEIGHTS },
  );

  const thu = sum(
    data.vouchers.filter((v) => v.type === 'RECEIPT'),
    (v) => v.amount,
  );
  const chi = sum(
    data.vouchers.filter((v) => v.type === 'PAYMENT'),
    (v) => v.amount,
  );
  const kpis: DashboardKpi[] = [
    { label: 'ĐÃ THU TRONG KỲ', value: thu },
    { label: 'ĐÃ CHI TRONG KỲ', value: chi },
    { label: 'CÒN PHẢI THU (NỢ MỞ)', value: receivable.totalBalance },
    { label: 'CÒN PHẢI TRẢ (NỢ MỞ)', value: payable.totalBalance },
  ];
  const chartsRow = writeKpiCards(dashboard, kpiStart, kpis);

  // Bảng dữ liệu chart xếp dọc ở vùng bên phải (ngoài vùng in A–P)
  const col = DASHBOARD_DATA_START_COL;
  const widths = [34, 16, 16];

  const agingRows: [string, number, number][] = [
    [AGING_LABELS[0], receivable.b0_30, payable.b0_30],
    [AGING_LABELS[1], receivable.b31_60, payable.b31_60],
    [AGING_LABELS[2], receivable.b61_90, payable.b61_90],
    [AGING_LABELS[3], receivable.over90, payable.over90],
  ];
  const agingTable = writeDataTable(dashboard, {
    startRow: chartsRow,
    startCol: col,
    columnWidths: widths,
    title: 'Dữ liệu biểu đồ: Tuổi nợ phải thu vs phải trả',
    headers: ['Khoảng tuổi nợ', 'Phải thu', 'Phải trả'],
    rows: agingRows,
    numFmts: [undefined, MONEY, MONEY],
  });

  const cashflowRows = bucketCashflow(data.vouchers);
  const cashflowTable = writeDataTable(dashboard, {
    startRow: agingTable.nextRow,
    startCol: col,
    columnWidths: widths,
    title: 'Dữ liệu biểu đồ: Thu vs chi (theo ngày, kỳ dài gộp theo tuần)',
    headers: ['Mốc thời gian', 'Thu', 'Chi'],
    rows:
      cashflowRows.length > 0
        ? cashflowRows.map((b) => [b.label, b.thu, b.chi])
        : [['Không có phiếu', 0, 0]],
    numFmts: [undefined, MONEY, MONEY],
  });

  const groupRows: [string, number][] = (data.customerSections ?? [])
    .filter((s) => (s.balanceAmount || 0) > 0)
    .map((s) => [s.title, s.balanceAmount]);
  const groupTable = writeDataTable(dashboard, {
    startRow: cashflowTable.nextRow,
    startCol: col,
    columnWidths: widths,
    title: 'Dữ liệu biểu đồ: Còn phải thu theo nhóm đối tượng',
    headers: ['Nhóm đối tượng', 'Còn phải thu'],
    rows: groupRows.length > 0 ? groupRows : [['Không có dữ liệu', 0]],
    numFmts: [undefined, MONEY],
  });

  const charts: XlsxChartSpec[] = [
    {
      type: 'column',
      title: 'Tuổi nợ phải thu vs phải trả',
      anchor: { fromCol: 0, fromRow: 0, toCol: 0, toRow: 0 },
      categoriesRef: agingTable.ref(0),
      categories: agingRows.map((r) => r[0]),
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      series: [
        {
          name: 'Phải thu',
          valuesRef: agingTable.ref(1),
          values: agingRows.map((r) => r[1]),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Phải trả',
          valuesRef: agingTable.ref(2),
          values: agingRows.map((r) => r[2]),
          color: CHART_PALETTE[1],
        },
      ],
    },
    {
      type: 'column',
      title: 'Thu vs chi trong kỳ',
      anchor: { fromCol: 0, fromRow: 0, toCol: 0, toRow: 0 },
      categoriesRef: cashflowTable.ref(0),
      categories:
        cashflowRows.length > 0
          ? cashflowRows.map((b) => b.label)
          : ['Không có phiếu'],
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      labelFontSize: 700,
      series: [
        {
          name: 'Thu',
          valuesRef: cashflowTable.ref(1),
          values:
            cashflowRows.length > 0 ? cashflowRows.map((b) => b.thu) : [0],
          color: CHART_PALETTE[0],
        },
        {
          name: 'Chi',
          valuesRef: cashflowTable.ref(2),
          values:
            cashflowRows.length > 0 ? cashflowRows.map((b) => b.chi) : [0],
          color: CHART_PALETTE[3],
        },
      ],
    },
  ];

  if (groupRows.length > 0) {
    charts.push({
      type: 'doughnut',
      title: 'Còn phải thu theo nhóm đối tượng',
      anchor: { fromCol: 0, fromRow: 0, toCol: 0, toRow: 0 },
      categoriesRef: groupTable.ref(0),
      categories: groupRows.map((r) => r[0]),
      series: [
        {
          name: 'Còn phải thu',
          valuesRef: groupTable.ref(1),
          values: groupRows.map((r) => r[1]),
          color: CHART_PALETTE[0],
        },
      ],
      pointColors: [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[4]],
      dataLabels: true,
    });
  }

  // Các chart chia đều một hàng (2 hoặc 3 chart)
  charts.forEach((chart, slot) => {
    chart.anchor = chartAnchorRow(
      chartsRow,
      slot,
      charts.length,
      DASHBOARD_CHART_ROWS,
    );
  });

  const footnoteRow = writeFootnote(
    dashboard,
    rowAfterCharts(chartsRow, 1),
    'Nguồn số liệu: đã thu, đã chi theo ngày giao dịch của phiếu thu chi xưởng; nợ còn mở (từ 01/07/2026, không giới hạn theo kỳ) và tuổi nợ tính đến ngày xuất. Doanh thu, giá vốn, lãi gộp xem sheet "Báo cáo lợi nhuận". Số dạng "tr" là triệu đồng, "k" là nghìn đồng.',
  );
  setDashboardPrintArea(dashboard, footnoteRow);
  return charts;
}
