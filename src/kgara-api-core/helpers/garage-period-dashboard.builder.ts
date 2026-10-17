import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_COLUMNS,
  rowAfterCharts,
  setDashboardPrintArea,
  writeAlertCards,
  writeDashboardHeader,
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
  buildOverdueAlertCards,
  buildPeriodDebtKpis,
} from './garage-period-summary-cards.helper';
import { summarizePeriod } from './garage-period-summary.builder';

/** Chiều cao 3 dòng card cảnh báo (nhãn, giá trị, ghi chú) để cả sheet gọn một màn hình. */
const ALERT_HEIGHTS: [number, number, number] = [14, 22, 20];

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
 * Dashboard báo cáo kỳ gói gọn một màn hình (không số đối tượng): thu chi trong kỳ, công nợ
 * phát sinh trong kỳ, cảnh báo nợ 61-90 và trên 90 ngày, 2 chart. Trả về cấu hình chart để
 * chèn sau khi ghi buffer.
 */
export function buildPeriodDashboard(
  dashboard: ExcelJS.Worksheet,
  data: GaragePeriodReportData,
): XlsxChartSpec[] {
  const summary = summarizePeriod(data);

  let row = writeDashboardHeader(
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

  row = writeKpiCards(dashboard, row, buildCashflowKpis(summary), {
    title: 'Thu chi trong kỳ',
  });
  row = writeKpiCards(dashboard, row, buildPeriodDebtKpis(summary), {
    title: 'Công nợ phát sinh trong kỳ (phiếu hoàn thành trong kỳ)',
  });
  row = writeAlertCards(
    dashboard,
    row,
    buildOverdueAlertCards(summary.receivable, summary.payable),
    {
      title:
        'Công nợ quá hạn lũy kế đến ngày xuất: 61-90 và trên 90 ngày (phải thu | phải trả)',
      heights: ALERT_HEIGHTS,
    },
  );

  // 2 chart cạnh nhau trên một hàng: thu/chi và tuổi nợ
  const charts = buildDashboardCharts(dashboard, data, summary, row);
  const unit = BUCKET_UNIT_LABEL[bucketUnitOf(data)];
  const footnoteRow = writeFootnote(
    dashboard,
    rowAfterCharts(row, 1, PERIOD_CHART_ROWS),
    `Chart thu chi theo ${unit}. Công nợ lũy kế là nợ còn mở từ 01/07/2026 đến ngày xuất. Chi tiết từng đối tượng xem các sheet bên cạnh; số "tr" là triệu đồng, "k" là nghìn đồng.`,
  );
  setDashboardPrintArea(dashboard, footnoteRow);
  return charts;
}
