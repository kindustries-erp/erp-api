import * as ExcelJS from 'exceljs';

import {
  rowAfterCharts,
  setDashboardPrintArea,
  writeDashboardHeader,
  writeGroupTitle,
  writeKpiCards,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import type { XlsxChartSpec } from '../../common/xlsx-charts/xlsx-chart.types';
import { formatPeriod } from './garage-debts-export.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import {
  PERIOD_CHART_ROWS,
  buildDashboardCharts,
} from './garage-period-dashboard-charts.helper';
import { BUCKET_UNIT_LABEL, bucketUnitOf } from './garage-period-series.helper';
import {
  buildCashflowKpis,
  buildOpenDebtKpis,
  buildPeriodDebtKpis,
} from './garage-period-summary-cards.helper';
import { summarizePeriod } from './garage-period-summary.builder';

/** Tên sheet và số cột của báo cáo kỳ (sheet "Báo cáo", 3 cột đều nhau 6 cột). */
export const PERIOD_REPORT_SHEET = 'Báo cáo';
export const PERIOD_REPORT_COLUMNS = 18;

/** Ghi chú nguồn số liệu một dòng ở cuối sheet. */
function writeFootnote(
  sheet: ExcelJS.Worksheet,
  row: number,
  text: string,
): number {
  sheet.mergeCells(row, 1, row, PERIOD_REPORT_COLUMNS);
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

/** Cột (1-based) đầu và cuối của từng vùng 6 cột: thu chi, tuổi nợ, phát sinh theo nhóm. */
const COLUMN_SPANS = [
  { startCol: 1, endCol: 6 },
  { startCol: 7, endCol: 12 },
  { startCol: 13, endCol: 18 },
];

/**
 * Báo cáo kỳ (sheet "Báo cáo"): 3 cột có tiêu đề riêng. Cột 1 thu chi và cột 2 tuổi nợ, mỗi
 * cột 4 thẻ (2 thẻ/hàng); cột 3 là 2 thẻ phát sinh nằm ngay trên chart nhóm khách. Chart cột 1,
 * 2 bắt đầu sau 2 hàng thẻ; chart cột 3 cao hơn để đáy ba chart ngang nhau. Không số đối tượng.
 */
export function buildPeriodDashboard(
  dashboard: ExcelJS.Worksheet,
  data: GaragePeriodReportData,
): XlsxChartSpec[] {
  const summary = summarizePeriod(data);

  const headerRow = writeDashboardHeader(
    dashboard,
    'Báo cáo thu chi & công nợ Garage',
    [
      `${formatPeriod({
        dateFrom: data.from,
        dateTo: data.to,
        asOfDate: data.asOfDate,
      })} · Chi nhánh: ${data.branchLabel || 'Tất cả chi nhánh'}`,
    ],
    PERIOD_REPORT_COLUMNS,
  );

  // Ba cột thẻ cùng bắt đầu từ một dòng để chữ và số thẳng hàng
  writeGroupTitle(dashboard, headerRow, 'Thu chi trong kỳ', COLUMN_SPANS[0]);
  writeGroupTitle(
    dashboard,
    headerRow,
    'Tuổi nợ lũy kế đến ngày xuất',
    COLUMN_SPANS[1],
  );
  const cashRow = writeKpiCards(
    dashboard,
    headerRow + 1,
    buildCashflowKpis(summary),
    {
      startCol: COLUMN_SPANS[0].startCol,
      cardCols: 3,
      cardsPerRow: 2,
      reserveNote: true,
    },
  );
  const debtRow = writeKpiCards(
    dashboard,
    headerRow + 1,
    buildOpenDebtKpis(summary),
    {
      startCol: COLUMN_SPANS[1].startCol,
      cardCols: 3,
      cardsPerRow: 2,
      reserveNote: true,
    },
  );
  const groupRow = writeKpiCards(
    dashboard,
    headerRow,
    buildPeriodDebtKpis(summary),
    {
      title: 'Phát sinh trong kỳ theo nhóm khách',
      startCol: COLUMN_SPANS[2].startCol,
      cardCols: 3,
      cardsPerRow: 2,
      reserveNote: true,
    },
  );

  // Chart cột 1, 2 bắt đầu sau hai hàng thẻ; chart cột 3 bắt đầu sau một hàng thẻ
  const chartTop = Math.max(cashRow, debtRow);
  const charts = buildDashboardCharts(
    dashboard,
    data,
    summary,
    chartTop,
    groupRow,
    PERIOD_REPORT_COLUMNS + 2,
  );
  const unit = BUCKET_UNIT_LABEL[bucketUnitOf(data)];
  const footnoteRow = writeFootnote(
    dashboard,
    rowAfterCharts(chartTop, 1, PERIOD_CHART_ROWS),
    `Chart thu chi theo ${unit}: dự chi là phiếu chi Chờ duyệt + Đã duyệt; dòng tiền ròng = thu − chi. Nợ lũy kế là nợ còn mở từ 01/07/2026 đến ngày xuất. Phải thu/chi theo nhóm khách tách theo có VAT và không VAT. Chi tiết từng đối tượng xem các sheet bên cạnh; số "tr" là triệu đồng, "k" là nghìn đồng.`,
  );
  setDashboardPrintArea(dashboard, footnoteRow, PERIOD_REPORT_COLUMNS);
  return charts;
}
