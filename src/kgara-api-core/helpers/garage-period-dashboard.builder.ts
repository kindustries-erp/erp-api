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
import { buildDashboardCharts } from './garage-period-dashboard-charts.helper';
import { BUCKET_UNIT_LABEL, bucketUnitOf } from './garage-period-series.helper';
import {
  buildCashflowKpis,
  buildDebtCards,
  buildPeriodDebtKpis,
} from './garage-period-summary-cards.helper';
import { summarizePeriod } from './garage-period-summary.builder';

/** Chiều cao 3 dòng card công nợ (nhãn, giá trị, ghi chú) để cả sheet gọn một màn hình. */
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
 * Dashboard báo cáo kỳ gồm card, số tổng và 3 chart (không số đối tượng): thu chi trong
 * kỳ, công nợ phát sinh trong kỳ, công nợ lũy kế đến ngày xuất (tuổi nợ phải thu/phải trả).
 * Trả về cấu hình chart để chèn sau khi ghi buffer.
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
  row = writeKpiCards(
    dashboard,
    row,
    buildPeriodDebtKpis('receivable', summary.periodReceivable),
    { title: 'Công nợ phát sinh trong kỳ - phải thu (khách hàng)' },
  );
  row = writeKpiCards(
    dashboard,
    row,
    buildPeriodDebtKpis('payable', summary.periodPayable),
    { title: 'Công nợ phát sinh trong kỳ - phải trả (nhà cung cấp)' },
  );
  row = writeAlertCards(dashboard, row, buildDebtCards(summary.receivable), {
    title: 'Công nợ lũy kế đến ngày xuất - phải thu (khách hàng)',
    heights: ALERT_HEIGHTS,
  });
  row = writeAlertCards(dashboard, row, buildDebtCards(summary.payable), {
    title: 'Công nợ lũy kế đến ngày xuất - phải trả (nhà cung cấp)',
    heights: ALERT_HEIGHTS,
  });

  // Chart xếp lưới 2 cột: 2 chart hàng đầu, chart thứ 3 rộng hết hàng thứ hai
  const charts = buildDashboardCharts(dashboard, data, summary, row);
  const unit = BUCKET_UNIT_LABEL[bucketUnitOf(data)];
  const footnoteRow = writeFootnote(
    dashboard,
    rowAfterCharts(row, 2),
    `Nguồn số liệu: đã thu, đã chi theo ngày giao dịch của phiếu thu chi xưởng; công nợ trong kỳ tính trên phiếu hoàn thành trong kỳ; công nợ lũy kế là nợ còn mở từ 01/07/2026 đến ngày xuất. Chart theo kỳ gom theo ${unit}. Chi tiết từng đối tượng xem các sheet bên cạnh. Số dạng "tr" là triệu đồng, "k" là nghìn đồng.`,
  );
  setDashboardPrintArea(dashboard, footnoteRow);
  return charts;
}
