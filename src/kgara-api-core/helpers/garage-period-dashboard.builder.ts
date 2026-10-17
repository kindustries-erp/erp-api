import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_COLUMNS,
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
import { buildPeriodDebtKpis } from './garage-period-summary-cards.helper';
import { summarizePeriod } from './garage-period-summary.builder';

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
 * Dashboard báo cáo kỳ gói gọn một màn hình (không số đối tượng): công nợ phát sinh trong kỳ
 * (kèm ±% so với kỳ trước), 2 chart (thu/chi/dự chi + dòng tiền ròng theo thời gian; tuổi nợ).
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

  // 3 cột, mỗi cột một tiêu đề: thu chi (A–E), tuổi nợ (F–J), phát sinh theo nhóm khách (K–P).
  // Hai thẻ phát sinh nằm trong cột 3, ngay trên chart nhóm khách.
  const headerRow = row;
  writeGroupTitle(dashboard, headerRow, 'Thu chi trong kỳ', {
    startCol: 1,
    endCol: 5,
  });
  writeGroupTitle(dashboard, headerRow, 'Tuổi nợ lũy kế đến ngày xuất', {
    startCol: 6,
    endCol: 10,
  });
  row = writeKpiCards(dashboard, headerRow, buildPeriodDebtKpis(summary), {
    title: 'Phát sinh trong kỳ theo nhóm khách',
    startCol: 11,
    cardCols: 3,
    cardsPerRow: 2,
  });

  // 3 chart lớn một hàng: thu/chi/dự chi + dòng tiền ròng, tuổi nợ, phải thu theo nhóm khách
  const charts = buildDashboardCharts(dashboard, data, summary, row);
  const unit = BUCKET_UNIT_LABEL[bucketUnitOf(data)];
  const footnoteRow = writeFootnote(
    dashboard,
    rowAfterCharts(row, 1, PERIOD_CHART_ROWS),
    `Chart thu chi theo ${unit}: dự chi là phiếu chi Chờ duyệt + Đã duyệt; dòng tiền ròng = thu − chi. Công nợ lũy kế là nợ còn mở từ 01/07/2026 đến ngày xuất. Chi tiết từng đối tượng xem các sheet bên cạnh; số "tr" là triệu đồng, "k" là nghìn đồng.`,
  );
  setDashboardPrintArea(dashboard, footnoteRow);
  return charts;
}
