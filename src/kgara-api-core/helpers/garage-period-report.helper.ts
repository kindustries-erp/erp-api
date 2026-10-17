import * as ExcelJS from 'exceljs';

import { createDashboardSheet } from '../../common/xlsx-charts/dashboard-sheet.helper';
import { injectCharts } from '../../common/xlsx-charts/xlsx-chart-injector';
import {
  DEBT_DASHBOARD_SHEET,
  GARAGE_DEBT_CASE_COLUMNS,
  applyAgingColumnStyles,
  buildDebtDetailSheet,
  buildSingleGroupDebtSheet,
  debtRowLabel,
  formatDebtExportDate,
  type GarageDebtExportRow,
} from './garage-debts-export.helper';
import {
  applyStandardExcelReportLayout,
  borderThin,
  initSheetStructure,
  type ExcelReportColumnDef,
} from './kgara-excel-style.helper';
import {
  PERIOD_REPORT_COLUMNS,
  PERIOD_REPORT_SHEET,
  buildPeriodDashboard,
} from './garage-period-dashboard.builder';
import { PNL_SHEET, buildPnlSheet } from './garage-period-pnl.builder';
import { resolvePeriodReportSections } from './garage-period-report-sections.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';

export const OVERDUE_SHEET = 'Nợ quá hạn cần chú ý';
export const CASHFLOW_SHEET = 'Thu chi trong kỳ';

const MONEY = '#,##0';

const OVERDUE_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'stt', width: 6, align: 'center' },
  { header: 'Loại', key: 'side', width: 12 },
  { header: 'Biển số xe', key: 'licensePlate', width: 16 },
  { header: 'Mã đối tượng', key: 'partnerCode', width: 16 },
  { header: 'Đối tượng', key: 'partnerName', width: 34 },
  { header: 'Số phiếu', key: 'caseCount', width: 10, align: 'right' },
  {
    header: 'Còn nợ',
    key: 'balanceAmount',
    width: 18,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ 0-30 ngày',
    key: 'aging0_30',
    width: 16,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ 31-60 ngày',
    key: 'aging31_60',
    width: 16,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ 61-90 ngày',
    key: 'aging61_90',
    width: 16,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ >90 ngày',
    key: 'agingOver90',
    width: 16,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Tuổi nợ lớn nhất (ngày)',
    key: 'maxAgingDays',
    width: 14,
    align: 'right',
  },
];

const CASHFLOW_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'stt', width: 6, align: 'center' },
  { header: 'Ngày', key: 'transDate', width: 12, align: 'center' },
  { header: 'Mã phiếu', key: 'voucherCode', width: 16 },
  { header: 'Loại', key: 'typeLabel', width: 8, align: 'center' },
  { header: 'Nội dung', key: 'paymentContent', width: 26 },
  { header: 'Đối tác', key: 'partnerName', width: 30 },
  { header: 'Biển số xe', key: 'licensePlate', width: 14 },
  { header: 'Số phiếu dịch vụ', key: 'soChungTu', width: 20 },
  { header: 'Hình thức', key: 'methodLabel', width: 14 },
  { header: 'Ghi chú', key: 'note', width: 30 },
  {
    header: 'Thu',
    key: 'receipt',
    width: 16,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
  {
    header: 'Chi',
    key: 'payment',
    width: 16,
    align: 'right',
    isSum: true,
    style: { numFmt: MONEY },
  },
];

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  POS: 'Quẹt thẻ',
  OTHER: 'Khác',
};

const num = (value: unknown) => Number(value) || 0;

/** Sheet nợ quá hạn (>30 ngày) của cả phải thu và phải trả, nợ >90 ngày lớn nhất lên đầu. */
export function buildOverdueSheet(
  workbook: ExcelJS.Workbook,
  receivable: GarageDebtExportRow[],
  payable: GarageDebtExportRow[],
): void {
  const sheet = workbook.addWorksheet(OVERDUE_SHEET);
  initSheetStructure(sheet, OVERDUE_COLUMNS);

  const overdue = (r: GarageDebtExportRow) =>
    num(r.aging31_60) + num(r.aging61_90) + num(r.agingOver90);
  const rows = [
    ...receivable.map((row) => ({ side: 'Phải thu', row })),
    ...payable.map((row) => ({ side: 'Phải trả', row })),
  ]
    .filter(({ row }) => overdue(row) > 0)
    .sort(
      (a, b) =>
        num(b.row.agingOver90) - num(a.row.agingOver90) ||
        num(b.row.aging61_90) - num(a.row.aging61_90) ||
        num(b.row.aging31_60) - num(a.row.aging31_60),
    );

  const sums: Record<string, number> = {};
  OVERDUE_COLUMNS.forEach((c) => {
    if (c.isSum) sums[c.key] = 0;
  });

  rows.forEach(({ side, row }, index) => {
    const values: Record<string, string | number> = {
      stt: index + 1,
      side,
      licensePlate: row.licensePlate,
      partnerCode: row.partnerCode,
      partnerName: row.partnerName || debtRowLabel(row),
      caseCount: num(row.caseCount),
      balanceAmount: num(row.balanceAmount),
      aging0_30: num(row.aging0_30),
      aging31_60: num(row.aging31_60),
      aging61_90: num(row.aging61_90),
      agingOver90: num(row.agingOver90),
      maxAgingDays: num(row.maxAgingDays),
    };
    Object.keys(sums).forEach((key) => {
      sums[key] += num(values[key]);
    });
    const excelRow = sheet.addRow(values);
    OVERDUE_COLUMNS.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.border = borderThin;
      cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
      if (col.style?.numFmt) cell.numFmt = col.style.numFmt;
    });
  });

  applyStandardExcelReportLayout(sheet, OVERDUE_COLUMNS, 5, sums);
  applyAgingColumnStyles(sheet, OVERDUE_COLUMNS);
}

/** Sheet phiếu thu/chi xưởng trong kỳ: số tiền tách cột Thu và cột Chi để tổng không lẫn. */
export function buildCashflowSheet(
  workbook: ExcelJS.Workbook,
  vouchers: GaragePeriodReportData['vouchers'],
): void {
  const sheet = workbook.addWorksheet(CASHFLOW_SHEET);
  initSheetStructure(sheet, CASHFLOW_COLUMNS);

  const sums = { receipt: 0, payment: 0 };
  vouchers.forEach((v, index) => {
    const isPayment = v.type === 'PAYMENT';
    sums.receipt += isPayment ? 0 : v.amount;
    sums.payment += isPayment ? v.amount : 0;

    const excelRow = sheet.addRow({
      stt: index + 1,
      transDate: formatDebtExportDate(v.transDate),
      voucherCode: v.voucherCode,
      typeLabel: isPayment ? 'Chi' : 'Thu',
      paymentContent: v.paymentContent,
      partnerName: v.partnerName,
      licensePlate: v.licensePlate,
      soChungTu: v.soChungTu,
      methodLabel: METHOD_LABEL[v.paymentMethod] ?? v.paymentMethod,
      note: v.note,
      receipt: isPayment ? null : v.amount,
      payment: isPayment ? v.amount : null,
    });
    CASHFLOW_COLUMNS.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.border = borderThin;
      cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
      if (col.style?.numFmt) cell.numFmt = col.style.numFmt;
    });
  });

  applyStandardExcelReportLayout(sheet, CASHFLOW_COLUMNS, 6, sums);
}

/**
 * Dựng file báo cáo Garage theo kỳ:
 * Dashboard (card + số tổng, không chart) → Báo cáo lợi nhuận (P&L, kèm chart) →
 * sheet từng nhóm đối tượng phải thu → Công nợ phải trả → Nợ quá hạn cần chú ý →
 * Thu chi trong kỳ.
 */
export async function buildGaragePeriodReport(
  data: GaragePeriodReportData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Liouni ERP';
  workbook.lastModifiedBy = 'Liouni ERP';
  workbook.created = new Date();

  const sectionSet = resolvePeriodReportSections(
    data.reportType,
    data.reportSections,
  );

  // Dashboard phải tạo trước để nằm đầu file, kế đó là sheet P&L
  const dashboard = sectionSet.has('dashboard')
    ? createDashboardSheet(workbook, PERIOD_REPORT_SHEET, PERIOD_REPORT_COLUMNS)
    : null;
  const pnlCharts = sectionSet.has('pnl')
    ? buildPnlSheet(workbook, data.pnlMonths, {
        periodSize: data.pnlPeriodSize ?? 1,
      })
    : null;

  if (sectionSet.has('receivables')) {
    const sections = (data.customerSections ?? []).filter(
      (s) => s.cases.length > 0 || s.totalAmount !== 0,
    );
    if (sections.length > 0) {
      sections.forEach((section) =>
        buildSingleGroupDebtSheet(
          workbook,
          section.title,
          section,
          GARAGE_DEBT_CASE_COLUMNS,
        ),
      );
    } else {
      buildDebtDetailSheet(workbook, 'customers', data.customerRows);
    }
  }
  if (sectionSet.has('payables')) {
    buildDebtDetailSheet(workbook, 'suppliers', data.supplierRows);
  }
  if (sectionSet.has('overdue')) {
    buildOverdueSheet(workbook, data.openCustomerRows, data.openSupplierRows);
  }
  if (sectionSet.has('cashflow')) {
    buildCashflowSheet(workbook, data.vouchers);
  }

  const dashboardCharts = dashboard
    ? buildPeriodDashboard(dashboard, data)
    : [];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const withDashboard = await injectCharts(
    buffer,
    PERIOD_REPORT_SHEET,
    dashboardCharts,
  );
  return pnlCharts
    ? injectCharts(withDashboard, PNL_SHEET, pnlCharts)
    : withDashboard;
}
