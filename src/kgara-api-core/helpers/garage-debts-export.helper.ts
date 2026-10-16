import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_DATA_START_COL,
  chartAnchor,
  columnLetter,
  createDashboardSheet,
  rowAfterCharts,
  setDashboardPrintArea,
  writeDashboardHeader,
  writeDataTable,
  writeKpiCards,
  type DashboardKpi,
} from '../../common/xlsx-charts/dashboard-sheet.helper';
import { injectCharts } from '../../common/xlsx-charts/xlsx-chart-injector';
import {
  CHART_PALETTE,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  applyStandardExcelReportLayout,
  initSheetStructure,
  borderThin,
  type ExcelReportColumnDef,
} from './kgara-excel-style.helper';

export type GarageDebtExportKind = 'customers' | 'suppliers';

/** Dòng chuẩn hóa dùng chung cho công nợ khách hàng và nhà cung cấp. */
export interface GarageDebtExportRow {
  licensePlate: string;
  partnerCode: string;
  partnerName: string;
  caseCount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  aging0_30: number;
  aging31_60: number;
  aging61_90: number;
  agingOver90: number;
  maxAgingDays: number;
  latestDate?: string | Date | null;
  oldestDate?: string | Date | null;
}

/** Thông tin hiển thị ở đầu sheet Dashboard. */
export interface GarageDebtReportMeta {
  /** `YYYY-MM-DD`; thiếu thì hiển thị "Tất cả". */
  dateFrom?: string;
  dateTo?: string;
  branchLabel?: string;
  /** Mô tả chế độ xuất (theo kỳ / theo filter hiện tại). */
  modeLabel?: string;
}

export const DEBT_DASHBOARD_SHEET = 'Dashboard';
const MONEY = '#,##0';
const TOP_N = 10;
const DETAIL_FIRST_ROW = 5;

const agingColumns: ExcelReportColumnDef[] = [
  {
    header: 'Nợ 0-30 ngày',
    key: 'aging0_30',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ 31-60 ngày',
    key: 'aging31_60',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ 61-90 ngày',
    key: 'aging61_90',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: MONEY },
  },
  {
    header: 'Nợ trên 90 ngày',
    key: 'agingOver90',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: MONEY },
  },
  {
    header: 'Tuổi nợ lớn nhất (ngày)',
    key: 'maxAgingDays',
    width: 14,
    align: 'center',
  },
  {
    header: 'Ngày phát sinh gần nhất',
    key: 'latestDate',
    width: 16,
    align: 'center',
  },
  {
    header: 'Ngày phát sinh xa nhất',
    key: 'oldestDate',
    width: 16,
    align: 'center',
  },
];

interface DebtLabels {
  total: string;
  paid: string;
  balance: string;
  partner: string;
  partnerCode: string;
  partnerCount: string;
}

export const GARAGE_DEBT_EXPORT_CONFIG: Record<
  GarageDebtExportKind,
  {
    sheetName: string;
    fileLabel: string;
    dashboardTitle: string;
    labels: DebtLabels;
    columns: ExcelReportColumnDef[];
  }
> = {
  customers: {
    sheetName: 'Công nợ phải thu',
    fileLabel: 'Cong_no_phai_thu_khach_hang',
    dashboardTitle: 'Dashboard công nợ phải thu - Khách hàng',
    labels: {
      total: 'Tổng phải thu',
      paid: 'Đã thu',
      balance: 'Còn phải thu',
      partner: 'Khách hàng',
      partnerCode: 'Mã khách hàng',
      partnerCount: 'Số xe / khách hàng',
    },
    columns: [
      { header: 'STT', key: 'stt', width: 7, align: 'center' },
      { header: 'Biển số xe', key: 'licensePlate', width: 14 },
      { header: 'Mã khách hàng', key: 'partnerCode', width: 16 },
      { header: 'Khách hàng', key: 'partnerName', width: 32 },
      {
        header: 'Số phiếu DV',
        key: 'caseCount',
        width: 12,
        isSum: true,
        align: 'center',
      },
      {
        header: 'Tổng phải thu',
        key: 'totalAmount',
        width: 16,
        isSum: true,
        align: 'right',
        style: { numFmt: MONEY },
      },
      {
        header: 'Đã thu',
        key: 'paidAmount',
        width: 16,
        isSum: true,
        align: 'right',
        style: { numFmt: MONEY },
      },
      {
        header: 'Còn phải thu',
        key: 'balanceAmount',
        width: 16,
        isSum: true,
        align: 'right',
        style: { numFmt: MONEY },
      },
      ...agingColumns,
    ],
  },
  suppliers: {
    sheetName: 'Công nợ phải trả',
    fileLabel: 'Cong_no_phai_tra_nha_cung_cap',
    dashboardTitle: 'Dashboard công nợ phải trả - Nhà cung cấp',
    labels: {
      total: 'Tổng phải trả',
      paid: 'Đã trả',
      balance: 'Còn phải trả',
      partner: 'Nhà cung cấp',
      partnerCode: 'Mã nhà cung cấp',
      partnerCount: 'Số xe / nhà cung cấp',
    },
    columns: [
      { header: 'STT', key: 'stt', width: 7, align: 'center' },
      { header: 'Biển số xe', key: 'licensePlate', width: 14 },
      { header: 'Mã nhà cung cấp', key: 'partnerCode', width: 16 },
      { header: 'Nhà cung cấp', key: 'partnerName', width: 32 },
      {
        header: 'Số phiếu DV',
        key: 'caseCount',
        width: 12,
        isSum: true,
        align: 'center',
      },
      {
        header: 'Tổng phải trả',
        key: 'totalAmount',
        width: 16,
        isSum: true,
        align: 'right',
        style: { numFmt: MONEY },
      },
      {
        header: 'Đã trả',
        key: 'paidAmount',
        width: 16,
        isSum: true,
        align: 'right',
        style: { numFmt: MONEY },
      },
      {
        header: 'Còn phải trả',
        key: 'balanceAmount',
        width: 16,
        isSum: true,
        align: 'right',
        style: { numFmt: MONEY },
      },
      ...agingColumns,
    ],
  },
};

/** dd/MM/yyyy; trả chuỗi rỗng khi không có/không hợp lệ. */
export function formatDebtExportDate(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function buildGarageDebtFileName(
  kind: GarageDebtExportKind,
  timestamp: string,
): string {
  return `${GARAGE_DEBT_EXPORT_CONFIG[kind].fileLabel}_${timestamp}.xlsx`;
}

const sumOf = (
  rows: GarageDebtExportRow[],
  pick: (r: GarageDebtExportRow) => number,
) => rows.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);

const shorten = (text: string, max = 32) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Nhãn một dòng top: biển số (nếu có) + tên đối tượng. */
export function debtRowLabel(row: GarageDebtExportRow): string {
  const plate = row.licensePlate || '(chưa có BKS)';
  return shorten(`${plate} - ${row.partnerName || row.partnerCode || ''}`);
}

/** Top N dòng còn nợ lớn nhất (bỏ dòng không còn nợ). */
export function topDebtRows(
  rows: GarageDebtExportRow[],
  limit = TOP_N,
): GarageDebtExportRow[] {
  return rows
    .filter((r) => (Number(r.balanceAmount) || 0) > 0)
    .sort((a, b) => b.balanceAmount - a.balanceAmount)
    .slice(0, limit);
}

const formatPeriod = (meta: GarageDebtReportMeta) =>
  meta.dateFrom || meta.dateTo
    ? `Kỳ: ${formatDebtExportDate(meta.dateFrom) || '...'} - ${formatDebtExportDate(meta.dateTo) || '...'}`
    : 'Kỳ: Tất cả';

/** Dựng sheet Dashboard (KPI + dữ liệu biểu đồ); trả về cấu hình chart cần chèn. */
function buildDebtDashboard(
  dashboard: ExcelJS.Worksheet,
  kind: GarageDebtExportKind,
  rows: GarageDebtExportRow[],
  meta: GarageDebtReportMeta,
): XlsxChartSpec[] {
  const config = GARAGE_DEBT_EXPORT_CONFIG[kind];
  const { labels, columns } = config;

  const detail = `'${config.sheetName.replace(/'/g, "''")}'`;
  const lastRow = DETAIL_FIRST_ROW + Math.max(rows.length, 1) - 1;
  const col = (key: string) => {
    const index = columns.findIndex((c) => c.key === key);
    return `${detail}!${columnLetter(index + 1)}${DETAIL_FIRST_ROW}:${columnLetter(index + 1)}${lastRow}`;
  };

  const total = sumOf(rows, (r) => r.totalAmount);
  const paid = sumOf(rows, (r) => r.paidAmount);
  const balance = sumOf(rows, (r) => r.balanceAmount);
  const over90 = sumOf(rows, (r) => r.agingOver90);

  const kpis: DashboardKpi[] = [
    {
      label: labels.total.toUpperCase(),
      value: { formula: `SUM(${col('totalAmount')})`, result: total },
    },
    {
      label: labels.paid.toUpperCase(),
      value: { formula: `SUM(${col('paidAmount')})`, result: paid },
    },
    {
      label: labels.balance.toUpperCase(),
      value: { formula: `SUM(${col('balanceAmount')})`, result: balance },
    },
    {
      label: 'TỶ LỆ THU HỒI / THANH TOÁN',
      value: {
        formula: `IF(SUM(${col('totalAmount')})=0,0,SUM(${col('paidAmount')})/SUM(${col('totalAmount')}))`,
        result: total === 0 ? 0 : paid / total,
      },
      numFmt: '0.0%',
    },
    { label: labels.partnerCount.toUpperCase(), value: rows.length },
    {
      label: 'SỐ PHIẾU DỊCH VỤ',
      value: {
        formula: `SUM(${col('caseCount')})`,
        result: sumOf(rows, (r) => r.caseCount),
      },
    },
    {
      label: 'NỢ TRÊN 90 NGÀY',
      value: { formula: `SUM(${col('agingOver90')})`, result: over90 },
    },
    {
      label: 'TUỔI NỢ LỚN NHẤT (NGÀY)',
      value: {
        formula: `MAX(${col('maxAgingDays')})`,
        result: Math.max(0, ...rows.map((r) => Number(r.maxAgingDays) || 0)),
      },
      numFmt: '0',
    },
  ];

  const nextRow = writeDashboardHeader(dashboard, config.dashboardTitle, [
    formatPeriod(meta),
    `Chi nhánh: ${meta.branchLabel || 'Tất cả chi nhánh'}`,
    ...(meta.modeLabel ? [`Chế độ: ${meta.modeLabel}`] : []),
  ]);
  const chartsRow = writeKpiCards(dashboard, nextRow, kpis);
  // Khối dữ liệu đặt bên phải vùng in, ngang hàng với chart đầu tiên.
  const dataRow = chartsRow;
  setDashboardPrintArea(dashboard, rowAfterCharts(chartsRow, 2));
  const agingCol = DASHBOARD_DATA_START_COL;
  const topCol = agingCol + 3;

  // Khối dữ liệu 1: cơ cấu tuổi nợ (công thức tham chiếu sheet chi tiết)
  const aging = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: agingCol,
    columnWidths: [22, 16],
    title: 'Dữ liệu biểu đồ: Cơ cấu tuổi nợ',
    headers: ['Nhóm tuổi nợ', 'Số tiền'],
    rows: [
      ['0-30 ngày', sumOf(rows, (r) => r.aging0_30)],
      ['31-60 ngày', sumOf(rows, (r) => r.aging31_60)],
      ['61-90 ngày', sumOf(rows, (r) => r.aging61_90)],
      ['Trên 90 ngày', over90],
    ],
    numFmts: [undefined, MONEY],
  });
  (['aging0_30', 'aging31_60', 'aging61_90', 'agingOver90'] as const).forEach(
    (key, i) => {
      const result = sumOf(rows, (r) => r[key]);
      dashboard.getCell(aging.firstDataRow + i, agingCol + 1).value = {
        formula: `SUM(${col(key)})`,
        result,
      };
    },
  );

  // Khối dữ liệu 2: Top N còn nợ
  const top = topDebtRows(rows);
  const topTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: topCol,
    columnWidths: [40, 16, 16],
    title: `Dữ liệu biểu đồ: Top ${TOP_N} ${labels.balance.toLowerCase()}`,
    headers: [`Biển số - ${labels.partner}`, labels.balance, labels.paid],
    rows: top.map((r) => [debtRowLabel(r), r.balanceAmount, r.paidAmount]),
    numFmts: [undefined, MONEY, MONEY],
  });

  const charts: XlsxChartSpec[] = [
    {
      type: 'doughnut',
      title: `Cơ cấu tuổi nợ (${labels.balance.toLowerCase()})`,
      anchor: chartAnchor(chartsRow, 0),
      categoriesRef: aging.ref(0),
      categories: ['0-30 ngày', '31-60 ngày', '61-90 ngày', 'Trên 90 ngày'],
      series: [
        {
          name: labels.balance,
          valuesRef: aging.ref(1),
          values: [
            sumOf(rows, (r) => r.aging0_30),
            sumOf(rows, (r) => r.aging31_60),
            sumOf(rows, (r) => r.aging61_90),
            over90,
          ],
          color: CHART_PALETTE[0],
        },
      ],
      pointColors: ['059669', 'CA8A04', 'EA580C', 'E11D48'],
    },
  ];

  if (top.length > 0) {
    const categories = top.map(debtRowLabel);
    charts.push(
      {
        type: 'bar',
        title: `Top ${TOP_N} ${labels.balance.toLowerCase()}`,
        anchor: chartAnchor(chartsRow, 1),
        categoriesRef: topTable.ref(0),
        categories,
        series: [
          {
            name: labels.balance,
            valuesRef: topTable.ref(1),
            values: top.map((r) => r.balanceAmount),
            color: CHART_PALETTE[3],
          },
        ],
        dataLabels: true,
        reverseCategories: true,
      },
      {
        type: 'column',
        title: `${labels.paid} và ${labels.balance.toLowerCase()} - Top ${TOP_N}`,
        anchor: chartAnchor(chartsRow, 2, { fullWidth: true }),
        categoriesRef: topTable.ref(0),
        categories,
        series: [
          {
            name: labels.paid,
            valuesRef: topTable.ref(2),
            values: top.map((r) => r.paidAmount),
            color: CHART_PALETTE[0],
          },
          {
            name: labels.balance,
            valuesRef: topTable.ref(1),
            values: top.map((r) => r.balanceAmount),
            color: CHART_PALETTE[3],
          },
        ],
      },
    );
  }
  return charts;
}

/** Sheet chi tiết theo layout chuẩn (SUM/SUBTOTAL hàng 1–2, header hàng 4, freeze). */
function buildDebtDetailSheet(
  workbook: ExcelJS.Workbook,
  kind: GarageDebtExportKind,
  rows: GarageDebtExportRow[],
) {
  const { sheetName, columns } = GARAGE_DEBT_EXPORT_CONFIG[kind];
  const sheet = workbook.addWorksheet(sheetName);
  initSheetStructure(sheet, columns);

  const sums: Record<string, number> = {};
  columns.forEach((c) => {
    if (c.isSum) sums[c.key] = 0;
  });

  rows.forEach((row, index) => {
    const values: Record<string, string | number> = {
      stt: index + 1,
      licensePlate: row.licensePlate,
      partnerCode: row.partnerCode,
      partnerName: row.partnerName,
      caseCount: row.caseCount,
      totalAmount: row.totalAmount,
      paidAmount: row.paidAmount,
      balanceAmount: row.balanceAmount,
      aging0_30: row.aging0_30,
      aging31_60: row.aging31_60,
      aging61_90: row.aging61_90,
      agingOver90: row.agingOver90,
      maxAgingDays: row.maxAgingDays,
      latestDate: formatDebtExportDate(row.latestDate),
      oldestDate: formatDebtExportDate(row.oldestDate),
    };
    Object.keys(sums).forEach((key) => {
      sums[key] += Number(values[key]) || 0;
    });

    const excelRow = sheet.addRow(values);
    columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.border = borderThin;
      cell.alignment = { horizontal: col.align || 'left', vertical: 'middle' };
      if (col.style?.numFmt) cell.numFmt = col.style.numFmt;
    });
  });

  // Cột "Khách hàng"/"Nhà cung cấp" (cột 4) làm nhãn cho hàng tổng.
  applyStandardExcelReportLayout(sheet, columns, 4, sums);
}

/**
 * Dựng file công nợ: sheet 1 `Dashboard` (KPI + chart gốc Excel), sheet 2 chi tiết.
 * Dashboard được tạo trước để nằm đầu file; chart được chèn sau khi ghi buffer.
 */
export async function buildGarageDebtReport(
  kind: GarageDebtExportKind,
  rows: GarageDebtExportRow[],
  meta: GarageDebtReportMeta = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Liouni ERP';
  workbook.lastModifiedBy = 'Liouni ERP';
  workbook.created = new Date();

  const dashboard = createDashboardSheet(workbook, DEBT_DASHBOARD_SHEET);
  buildDebtDetailSheet(workbook, kind, rows);
  const charts = buildDebtDashboard(dashboard, kind, rows, meta);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return injectCharts(buffer, DEBT_DASHBOARD_SHEET, charts);
}
