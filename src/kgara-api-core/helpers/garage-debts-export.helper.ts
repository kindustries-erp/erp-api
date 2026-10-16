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

export type GarageDebtExportKind = 'customers' | 'suppliers' | 'all';

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

/** Chỉ số tổng hợp theo từng nhóm đối tượng trên Dashboard. */
export interface GarageDebtGroupSummaryItem {
  groupName: string;
  partnerCount: number;
  caseCount: number;
  billed: number;
  paid: number;
  remaining: number;
  rate: number;
  withInvoiceAmount?: number;
  noInvoiceAmount?: number;
}

/** Thông tin hiển thị ở đầu sheet Dashboard. */
export interface GarageDebtReportMeta {
  /** `YYYY-MM-DD`; thiếu thì hiển thị "Tất cả". */
  dateFrom?: string;
  dateTo?: string;
  branchLabel?: string;
  /** Mô tả chế độ xuất (theo kỳ / theo filter hiện tại). */
  modeLabel?: string;
  customerGroupsSummary?: GarageDebtGroupSummaryItem[];
  payableGroupsSummary?: GarageDebtGroupSummaryItem[];
}

/**
 * Bản đồ màu sắc chuẩn hóa cho 4 khoảng tuổi nợ trong Excel,
 * khớp 100% với nhận diện màu sắc Tailwind trên Web:
 * - 0-30 ngày: Emerald (Xanh lá)
 * - 31-60 ngày: Amber (Vàng hổ phách)
 * - 61-90 ngày: Orange (Cam)
 * - >90 ngày: Rose (Đỏ)
 */
export const AGING_EXCEL_COLOR_MAP: Record<
  'aging0_30' | 'aging31_60' | 'aging61_90' | 'agingOver90',
  {
    header: { fill: string; font: string };
    data: { fill: string; font: string; bold?: boolean };
    summaryFont: string;
  }
> = {
  aging0_30: {
    header: { fill: 'FFD1FAE5', font: 'FF065F46' }, // Emerald-100 / Emerald-800
    data: { fill: 'FFF0FDF4', font: 'FF047857' }, // Emerald-50 / Emerald-700
    summaryFont: 'FF047857',
  },
  aging31_60: {
    header: { fill: 'FFFEF3C7', font: 'FF92400E' }, // Amber-100 / Amber-800
    data: { fill: 'FFFFFBEB', font: 'FF92400E' }, // Amber-50 / Amber-800
    summaryFont: 'FF92400E',
  },
  aging61_90: {
    header: { fill: 'FFFFEDD5', font: 'FF9A3412' }, // Orange-100 / Orange-800
    data: { fill: 'FFFFF7ED', font: 'FFC2410C' }, // Orange-50 / Orange-700
    summaryFont: 'FFC2410C',
  },
  agingOver90: {
    header: { fill: 'FFFFE4E6', font: 'FF9F1239' }, // Rose-100 / Rose-800
    data: { fill: 'FFFFF1F2', font: 'FFBE123C', bold: true }, // Rose-50 / Rose-700
    summaryFont: 'FFBE123C',
  },
};

/** Dòng dữ liệu chi tiết cho từng phiếu dịch vụ (Case). */
export interface GarageDebtCaseExportRow {
  stt?: number;
  caseId: string;
  soChungTu: string;
  bienSoXe: string;
  partnerTitle: string;
  partnerCode?: string;
  payerType: string;
  invoiceAndVat: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  aging0_30: number;
  aging31_60: number;
  aging61_90: number;
  agingOver90: number;
  shareRate: number;
  maxAgingDays: number;
  completedDate?: string;
}

/** Nhóm đối tượng gom các phiếu dịch vụ (VD: KH Doanh nghiệp, KH Cá nhân, Bảo hiểm). */
export interface GarageDebtGroupExportSection {
  key: string;
  title: string;
  partnerCount: number;
  caseCount: number;
  vehicleCount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  cases: GarageDebtCaseExportRow[];
}

export const DEBT_DASHBOARD_SHEET = 'Dashboard';
const MONEY = '#,##0';
const TOP_N = 10;
const DETAIL_FIRST_ROW = 5;

/** Định nghĩa cột cho danh sách chi tiết từng phiếu dịch vụ theo nhóm */
export const GARAGE_DEBT_CASE_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'stt', width: 7, align: 'center' },
  { header: 'Số chứng từ', key: 'soChungTuDisplay', width: 24, align: 'left' },
  {
    header: 'Khách hàng & Đối tượng HĐ',
    key: 'partnerTitle',
    width: 36,
    align: 'left',
  },
  { header: 'Loại thu', key: 'payerType', width: 14, align: 'center' },
  { header: 'Hóa đơn & VAT', key: 'invoiceAndVat', width: 20, align: 'center' },
  {
    header: 'Phát sinh',
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
    header: 'Tỷ trọng',
    key: 'shareRate',
    width: 12,
    align: 'right',
    style: { numFmt: '0.0%' },
  },
  {
    header: 'Tuổi nợ (ngày)',
    key: 'maxAgingDays',
    width: 14,
    align: 'center',
  },
  {
    header: 'Ngày hoàn thành',
    key: 'completedDate',
    width: 16,
    align: 'center',
  },
];

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
  all: {
    sheetName: 'Tổng hợp công nợ',
    fileLabel: 'Cong_no_tong_hop_garage',
    dashboardTitle: 'Dashboard tổng hợp công nợ garage (Phải thu & Phải trả)',
    labels: {
      total: 'Tổng giá trị giao dịch',
      paid: 'Đã thanh toán',
      balance: 'Còn công nợ ròng',
      partner: 'Đối tác',
      partnerCode: 'Mã đối tác',
      partnerCount: 'Số lượng đối tác',
    },
    columns: [],
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
/**
 * Áp dụng màu nền và màu chữ cho 4 cột tuổi nợ (Header, Data cells, và Summary)
 */
export function applyAgingColumnStyles(
  sheet: ExcelJS.Worksheet,
  columns: ExcelReportColumnDef[],
  startDataRow = 5,
  endDataRow = sheet.rowCount,
) {
  const agingKeys = [
    'aging0_30',
    'aging31_60',
    'aging61_90',
    'agingOver90',
  ] as const;

  agingKeys.forEach((key) => {
    const colIdx = columns.findIndex((c) => c.key === key);
    if (colIdx < 0) return;
    const excelCol = colIdx + 1;
    const colorSpec = AGING_EXCEL_COLOR_MAP[key];

    // 1. Header Cell (Row 4)
    const headerCell = sheet.getRow(4).getCell(excelCol);
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorSpec.header.fill },
    };
    headerCell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: colorSpec.header.font },
    };

    // 2. Summary Rows (Row 1 SUM & Row 2 SUBTOTAL)
    const sumCell = sheet.getRow(1).getCell(excelCol);
    if (sumCell.font) {
      sumCell.font = {
        ...sumCell.font,
        color: { argb: colorSpec.summaryFont },
      };
    }
    const subtotalCell = sheet.getRow(2).getCell(excelCol);
    if (subtotalCell.font) {
      subtotalCell.font = {
        ...subtotalCell.font,
        color: { argb: colorSpec.summaryFont },
      };
    }

    // 3. Data Rows
    for (let r = startDataRow; r <= endDataRow; r++) {
      const row = sheet.getRow(r);
      const cell = row.getCell(excelCol);
      const val = Number(cell.value) || 0;
      if (val > 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorSpec.data.fill },
        };
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: colorSpec.data.bold ?? false,
          color: { argb: colorSpec.data.font },
        };
      }
    }
  });
}

/**
 * Dựng một sheet chi tiết độc lập cho MỘT nhóm đối tượng (KH Doanh nghiệp, KH Cá nhân, hoặc Bảo hiểm).
 * Tuyệt đối KHÔNG chèn hàng tổng cộng subtotal xen kẽ giữa các case -> Giữ nguyên tính toàn vẹn
 * cho 2 hàng trên cùng (Row 1 SUM, Row 2 SUBTOTAL), triệt tiêu hoàn toàn lỗi double sum.
 */
export function buildSingleGroupDebtSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  section: GarageDebtGroupExportSection,
  columns: ExcelReportColumnDef[] = GARAGE_DEBT_CASE_COLUMNS,
  labelColIndex = 3,
) {
  const sheet = workbook.addWorksheet(sheetName);
  initSheetStructure(sheet, columns);

  const secSums: Record<string, number> = {
    totalAmount: 0,
    paidAmount: 0,
    balanceAmount: 0,
    aging0_30: 0,
    aging31_60: 0,
    aging61_90: 0,
    agingOver90: 0,
  };

  let stt = 1;

  section.cases.forEach((item) => {
    const rowValues: Record<string, any> = {
      stt: stt++,
      soChungTuDisplay: item.bienSoXe
        ? `${item.soChungTu} (${item.bienSoXe})`
        : item.soChungTu,
      partnerTitle: item.partnerTitle,
      payerType: item.payerType,
      invoiceAndVat: item.invoiceAndVat,
      totalAmount: item.totalAmount,
      paidAmount: item.paidAmount,
      balanceAmount: item.balanceAmount,
      aging0_30: item.aging0_30,
      aging31_60: item.aging31_60,
      aging61_90: item.aging61_90,
      agingOver90: item.agingOver90,
      shareRate: item.shareRate,
      maxAgingDays: item.maxAgingDays,
      completedDate: item.completedDate,
    };

    Object.keys(secSums).forEach((k) => {
      secSums[k] += Number(rowValues[k]) || 0;
    });

    const excelRow = sheet.addRow(rowValues);
    excelRow.height = 20;
    columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.border = borderThin;
      cell.alignment = {
        horizontal: col.align || 'left',
        vertical: 'middle',
      };
      if (col.style?.numFmt) cell.numFmt = col.style.numFmt;
    });
  });

  // Áp dụng layout chuẩn hóa cho 4 hàng đầu (Row 1 SUM, Row 2 SUBTOTAL, Row 3 Header, Row 4 STT)
  applyStandardExcelReportLayout(sheet, columns, labelColIndex, secSums);

  // Áp dụng bảng màu 4 khoảng tuổi nợ
  applyAgingColumnStyles(sheet, columns);
}

/**
 * Dựng sheet chi tiết tách theo từng phiếu dịch vụ (Case) và group theo đối tượng
 * (KH Doanh nghiệp, KH Cá nhân, Bảo hiểm).
 */
export function buildGroupedDebtDetailSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  sections: GarageDebtGroupExportSection[],
  labelColIndex = 3,
) {
  const sheet = workbook.addWorksheet(sheetName);
  const columns = GARAGE_DEBT_CASE_COLUMNS;
  initSheetStructure(sheet, columns);

  const totalSums: Record<string, number> = {
    totalAmount: 0,
    paidAmount: 0,
    balanceAmount: 0,
    aging0_30: 0,
    aging31_60: 0,
    aging61_90: 0,
    agingOver90: 0,
  };

  let globalStt = 1;

  sections.forEach((sec) => {
    if (sec.cases.length === 0 && sec.totalAmount === 0) return;

    // 1. Dòng Group Header (Kiểu Accordion banner tối màu)
    const headerRow = sheet.addRow([]);
    headerRow.height = 26;
    const headerCell = headerRow.getCell(1);
    const totalFormatted = new Intl.NumberFormat('vi-VN').format(
      sec.totalAmount,
    );
    headerCell.value = `▼ ${sec.title.toUpperCase()}   (${sec.partnerCount} đối tượng • ${sec.caseCount} phiếu   |   ${totalFormatted} đ)`;
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerCell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1,
    };
    sheet.mergeCells(headerRow.number, 1, headerRow.number, columns.length);

    for (let c = 1; c <= columns.length; c++) {
      headerRow.getCell(c).border = borderThin;
    }

    const secSums: Record<string, number> = {
      totalAmount: 0,
      paidAmount: 0,
      balanceAmount: 0,
      aging0_30: 0,
      aging31_60: 0,
      aging61_90: 0,
      agingOver90: 0,
    };

    // 2. Dòng từng phiếu dịch vụ
    sec.cases.forEach((item) => {
      const rowValues: Record<string, any> = {
        stt: globalStt++,
        soChungTuDisplay: item.bienSoXe
          ? `${item.soChungTu} (${item.bienSoXe})`
          : item.soChungTu,
        partnerTitle: item.partnerTitle,
        payerType: item.payerType,
        invoiceAndVat: item.invoiceAndVat,
        totalAmount: item.totalAmount,
        paidAmount: item.paidAmount,
        balanceAmount: item.balanceAmount,
        aging0_30: item.aging0_30,
        aging31_60: item.aging31_60,
        aging61_90: item.aging61_90,
        agingOver90: item.agingOver90,
        shareRate: item.shareRate,
        maxAgingDays: item.maxAgingDays,
        completedDate: item.completedDate,
      };

      Object.keys(secSums).forEach((k) => {
        secSums[k] += Number(rowValues[k]) || 0;
        totalSums[k] += Number(rowValues[k]) || 0;
      });

      const excelRow = sheet.addRow(rowValues);
      excelRow.height = 20;
      columns.forEach((col, i) => {
        const cell = excelRow.getCell(i + 1);
        cell.border = borderThin;
        cell.alignment = {
          horizontal: col.align || 'left',
          vertical: 'middle',
        };
        if (col.style?.numFmt) cell.numFmt = col.style.numFmt;
      });
    });

    // 3. Dòng Tổng cộng Group (Subtotal Banner)
    const subtotalRow = sheet.addRow([]);
    subtotalRow.height = 22;
    sheet.mergeCells(subtotalRow.number, 1, subtotalRow.number, 5);
    const subtotalLabelCell = subtotalRow.getCell(1);
    subtotalLabelCell.value = `TỔNG CỘNG (${sec.caseCount} PHIẾU • ${sec.vehicleCount || sec.partnerCount} XE)`;
    subtotalLabelCell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    subtotalLabelCell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    columns.forEach((col, idx) => {
      const cIdx = idx + 1;
      const cell = subtotalRow.getCell(cIdx);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (cIdx > 5) {
        if (secSums[col.key] !== undefined) {
          cell.value = secSums[col.key];
        }
        if (col.key === 'shareRate') {
          cell.value =
            totalSums.totalAmount > 0
              ? secSums.totalAmount / totalSums.totalAmount
              : 0;
        }
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF0F172A' },
        };
        cell.alignment = {
          horizontal: col.align || 'right',
          vertical: 'middle',
        };
        if (col.style?.numFmt) cell.numFmt = col.style.numFmt;
      }
    });

    // Dòng đệm giữa các group
    const spacerRow = sheet.addRow([]);
    spacerRow.height = 8;
  });

  // Áp dụng layout chuẩn hóa cho 4 hàng đầu
  applyStandardExcelReportLayout(sheet, columns, labelColIndex, totalSums);

  // Áp dụng bảng màu 4 cột tuổi nợ
  applyAgingColumnStyles(sheet, columns);
}

/**
 * Chuyển đổi dữ liệu phân loại đối tượng từ MonthlyReceivablesBreakdownResponse
 * thành các Section và Cases sẵn sàng để xuất Excel.
 */
export function convertReceivablesBreakdownToExportSections(
  breakdown: any,
): GarageDebtGroupExportSection[] {
  if (!breakdown?.categorized) return [];

  const now = new Date();
  const totalBilled = Number(breakdown.summary?.totalBilled) || 0;

  const mapGroupToSection = (
    key: string,
    title: string,
    categorizedGroup: any,
  ): GarageDebtGroupExportSection => {
    const allGroups = Array.isArray(categorizedGroup?.all)
      ? categorizedGroup.all
      : [];
    const cases: GarageDebtCaseExportRow[] = [];
    const vehicleSet = new Set<string>();

    allGroups.forEach((grp: any) => {
      const groupCases = Array.isArray(grp.cases) ? grp.cases : [];
      groupCases.forEach((c: any) => {
        if (c.bienSoXe) vehicleSet.add(c.bienSoXe);

        const completed = c.ngayHoanThanh ? new Date(c.ngayHoanThanh) : null;
        const days =
          completed && !isNaN(completed.getTime())
            ? Math.max(
                0,
                Math.floor(
                  (now.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24),
                ),
              )
            : 0;

        const remaining = Number(c.remaining) || 0;
        let a0_30 = 0;
        let a31_60 = 0;
        let a61_90 = 0;
        let aOver90 = 0;

        if (remaining > 0) {
          if (days <= 30) a0_30 = remaining;
          else if (days <= 60) a31_60 = remaining;
          else if (days <= 90) a61_90 = remaining;
          else aOver90 = remaining;
        }

        const effectiveInvoiceNo =
          c.invoiceNo || (grp.invoiceNos && grp.invoiceNos[0]);
        const invoiceAndVat = effectiveInvoiceNo
          ? `#${effectiveInvoiceNo}`
          : c.vatAmount > 0
            ? 'Chưa HĐ (Có VAT)'
            : 'Không VAT';

        cases.push({
          caseId: c.id,
          soChungTu: c.soChungTu || '',
          bienSoXe: c.bienSoXe || '',
          partnerTitle:
            grp.title || grp.buyerName || c.khachHangName || 'Khách lẻ',
          partnerCode: c.khachHangCode || grp.taxCode || '',
          payerType: grp.payerType === 'BH' ? 'Thu BH' : 'Thu KH',
          invoiceAndVat,
          totalAmount: Number(c.amount) || 0,
          paidAmount: Number(c.paid) || 0,
          balanceAmount: remaining,
          aging0_30: a0_30,
          aging31_60: a31_60,
          aging61_90: a61_90,
          agingOver90: aOver90,
          shareRate:
            totalBilled > 0 ? (Number(c.amount) || 0) / totalBilled : 0,
          maxAgingDays: days,
          completedDate: formatDebtExportDate(c.ngayHoanThanh),
        });
      });
    });

    const totals = categorizedGroup?.totals || {};
    return {
      key,
      title,
      partnerCount: allGroups.length,
      caseCount: cases.length,
      vehicleCount: vehicleSet.size,
      totalAmount:
        Number(totals.billed) || sumOfCases(cases, (r) => r.totalAmount),
      paidAmount: Number(totals.paid) || sumOfCases(cases, (r) => r.paidAmount),
      balanceAmount:
        Number(totals.remaining) || sumOfCases(cases, (r) => r.balanceAmount),
      cases,
    };
  };

  const sections: GarageDebtGroupExportSection[] = [];

  // 1. Nhóm Khách hàng Doanh nghiệp
  if (breakdown.categorized.enterprise) {
    sections.push(
      mapGroupToSection(
        'enterprise',
        'Thu Khách hàng Doanh nghiệp',
        breakdown.categorized.enterprise,
      ),
    );
  }

  // 2. Nhóm Khách hàng Cá nhân
  if (breakdown.categorized.individual) {
    sections.push(
      mapGroupToSection(
        'individual',
        'Thu Khách hàng Cá nhân',
        breakdown.categorized.individual,
      ),
    );
  }

  // 3. Nhóm Bảo hiểm
  if (breakdown.categorized.insurance) {
    sections.push(
      mapGroupToSection(
        'insurance',
        'Thu Bảo hiểm',
        breakdown.categorized.insurance,
      ),
    );
  }

  return sections;
}

function sumOfCases(
  cases: GarageDebtCaseExportRow[],
  pick: (c: GarageDebtCaseExportRow) => number,
): number {
  return cases.reduce((acc, c) => acc + (Number(pick(c)) || 0), 0);
}

/**
 * Trích xuất các chỉ số theo từng nhóm đối tượng để đưa vào sheet Dashboard.
 */
export function convertReceivablesBreakdownToGroupSummary(
  breakdown: any,
): GarageDebtGroupSummaryItem[] {
  if (!breakdown?.categorized) return [];

  const items: GarageDebtGroupSummaryItem[] = [];
  const addGroup = (name: string, cat: any) => {
    if (!cat) return;
    const totals = cat.totals || {};
    const billed = Number(totals.billed) || 0;
    const paid = Number(totals.paid) || 0;
    const remaining = Number(totals.remaining) || 0;
    const rate = billed > 0 ? paid / billed : 0;
    const partnerCount = Array.isArray(cat.all) ? cat.all.length : 0;
    const caseCount = Number(totals.caseCount) || 0;

    let withInvoiceAmount = 0;
    let noInvoiceAmount = 0;
    if (Array.isArray(cat.withInvoice)) {
      withInvoiceAmount = cat.withInvoice.reduce(
        (acc: number, item: any) => acc + (Number(item.billed) || 0),
        0,
      );
    }
    if (Array.isArray(cat.pendingInvoice)) {
      noInvoiceAmount += cat.pendingInvoice.reduce(
        (acc: number, item: any) => acc + (Number(item.billed) || 0),
        0,
      );
    }
    if (Array.isArray(cat.noInvoice)) {
      noInvoiceAmount += cat.noInvoice.reduce(
        (acc: number, item: any) => acc + (Number(item.billed) || 0),
        0,
      );
    }

    items.push({
      groupName: name,
      partnerCount,
      caseCount,
      billed,
      paid,
      remaining,
      rate,
      withInvoiceAmount,
      noInvoiceAmount,
    });
  };

  addGroup('Thu Khách hàng Doanh nghiệp', breakdown.categorized.enterprise);
  addGroup('Thu Khách hàng Cá nhân', breakdown.categorized.individual);
  addGroup('Thu Bảo hiểm', breakdown.categorized.insurance);

  return items;
}

/**
 * Vẽ các bảng chỉ số theo từng group đối tượng ngay trong vùng in của sheet Dashboard.
 */
function renderGroupSummaryTables(
  dashboard: ExcelJS.Worksheet,
  startRow: number,
  meta: GarageDebtReportMeta,
): number {
  let currentRow = startRow;

  if (meta.customerGroupsSummary && meta.customerGroupsSummary.length > 0) {
    const titleRow = dashboard.getRow(currentRow);
    titleRow.height = 24;
    titleRow.getCell(2).value = 'CƠ CẤU THU THEO ĐỐI TƯỢNG (PHẢI THU)';
    titleRow.getCell(2).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    currentRow++;

    const headers = [
      'Nhóm đối tượng',
      'Số đối tượng',
      'Số vụ việc',
      'Phát sinh',
      'Đã thu',
      'Còn nợ',
      'Tỷ lệ thu',
      'Có HĐ',
      'Chưa HĐ',
    ];
    const headerRow = dashboard.getRow(currentRow);
    headerRow.height = 20;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 2);
      cell.value = h;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
      cell.font = {
        name: 'Calibri',
        size: 9.5,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        horizontal: i >= 3 ? 'right' : 'center',
        vertical: 'middle',
      };
      cell.border = borderThin;
    });
    currentRow++;

    meta.customerGroupsSummary.forEach((grp) => {
      const row = dashboard.getRow(currentRow);
      row.height = 19;
      const values = [
        grp.groupName,
        grp.partnerCount,
        grp.caseCount,
        grp.billed,
        grp.paid,
        grp.remaining,
        grp.rate,
        grp.withInvoiceAmount ?? 0,
        grp.noInvoiceAmount ?? 0,
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 2);
        cell.value = v;
        cell.border = borderThin;
        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
        cell.alignment = {
          horizontal: i === 0 ? 'left' : i <= 2 ? 'center' : 'right',
          vertical: 'middle',
        };
        if (i >= 3 && i !== 6) cell.numFmt = MONEY;
        if (i === 6) cell.numFmt = '0.0%';
      });
      currentRow++;
    });

    currentRow += 2;
  }

  if (meta.payableGroupsSummary && meta.payableGroupsSummary.length > 0) {
    const titleRow = dashboard.getRow(currentRow);
    titleRow.height = 24;
    titleRow.getCell(2).value = 'CHI PHÍ PHÁT SINH & CÒN NỢ (PHẢI TRẢ)';
    titleRow.getCell(2).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    currentRow++;

    const headers = [
      'Nhóm chi phí',
      'Số đối tượng / phiếu',
      'Phát sinh',
      'Đã thanh toán',
      'Còn phải trả',
      'Tỷ lệ đã trả',
    ];
    const headerRow = dashboard.getRow(currentRow);
    headerRow.height = 20;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 2);
      cell.value = h;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
      cell.font = {
        name: 'Calibri',
        size: 9.5,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        horizontal: i >= 2 ? 'right' : 'center',
        vertical: 'middle',
      };
      cell.border = borderThin;
    });
    currentRow++;

    meta.payableGroupsSummary.forEach((grp) => {
      const row = dashboard.getRow(currentRow);
      row.height = 19;
      const values = [
        grp.groupName,
        grp.caseCount || grp.partnerCount,
        grp.billed,
        grp.paid,
        grp.remaining,
        grp.rate,
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 2);
        cell.value = v;
        cell.border = borderThin;
        cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
        cell.alignment = {
          horizontal: i === 0 ? 'left' : i === 1 ? 'center' : 'right',
          vertical: 'middle',
        };
        if (i >= 2 && i !== 5) cell.numFmt = MONEY;
        if (i === 5) cell.numFmt = '0.0%';
      });
      currentRow++;
    });

    currentRow += 2;
  }

  return currentRow;
}

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

  // Áp dụng bảng màu 4 cột tuổi nợ
  applyAgingColumnStyles(sheet, columns);
}

/**
 * Dựng sheet Dashboard đa biểu đồ và KPI chi tiết cho từng nhóm đối tượng
 * (KH Doanh nghiệp, KH Cá nhân, Bảo hiểm) và Nhà cung cấp.
 */
export function buildGroupedDebtDashboard(
  dashboard: ExcelJS.Worksheet,
  customerSections: GarageDebtGroupExportSection[],
  supplierRows: GarageDebtExportRow[],
  meta: GarageDebtReportMeta,
  kind: GarageDebtExportKind,
): XlsxChartSpec[] {
  // 1. Tổng hợp số liệu
  const totalCustBilled = customerSections.reduce(
    (acc, s) => acc + (s.totalAmount || 0),
    0,
  );
  const totalCustPaid = customerSections.reduce(
    (acc, s) => acc + (s.paidAmount || 0),
    0,
  );
  const totalCustBalance = customerSections.reduce(
    (acc, s) => acc + (s.balanceAmount || 0),
    0,
  );
  const custRate = totalCustBilled > 0 ? totalCustPaid / totalCustBilled : 0;

  const totalSuppBilled = sumOf(supplierRows, (r) => r.totalAmount);
  const totalSuppPaid = sumOf(supplierRows, (r) => r.paidAmount);
  const totalSuppBalance = sumOf(supplierRows, (r) => r.balanceAmount);

  const enterpriseSec = customerSections.find((s) => s.key === 'enterprise');
  const individualSec = customerSections.find((s) => s.key === 'individual');
  const insuranceSec = customerSections.find((s) => s.key === 'insurance');

  // 2. 8 Thẻ KPI (2 hàng x 4 thẻ)
  const kpis: DashboardKpi[] = [
    // Hàng 1: Toàn hệ thống
    {
      label: 'TỔNG PHÁT SINH (KHÁCH HÀNG)',
      value: totalCustBilled,
    },
    {
      label: 'ĐÃ THU (KHÁCH HÀNG)',
      value: totalCustPaid,
    },
    {
      label: 'CÒN PHẢI THU (KHÁCH HÀNG)',
      value: totalCustBalance,
    },
    {
      label: 'TỶ LỆ THU HỒI CÔNG NỢ KH',
      value: custRate,
      numFmt: '0.0%',
    },
    // Hàng 2: Từng nhóm đối tượng & Phải trả
    {
      label: 'THU KH DOANH NGHIỆP',
      value: enterpriseSec?.totalAmount || 0,
    },
    {
      label: 'THU KH CÁ NHÂN',
      value: individualSec?.totalAmount || 0,
    },
    {
      label: 'THU BẢO HIỂM',
      value: insuranceSec?.totalAmount || 0,
    },
    {
      label:
        kind === 'all' || supplierRows.length > 0
          ? 'CÒN PHẢI TRẢ (NCC)'
          : 'TỔNG SỐ PHIẾU DỊCH VỤ',
      value:
        kind === 'all' || supplierRows.length > 0
          ? totalSuppBalance
          : customerSections.reduce((acc, s) => acc + (s.caseCount || 0), 0),
    },
  ];

  const nextRow = writeDashboardHeader(
    dashboard,
    kind === 'all'
      ? 'Dashboard tổng hợp công nợ garage (Phải thu & Phải trả)'
      : 'Dashboard công nợ garage - Theo nhóm đối tượng',
    [
      formatPeriod(meta),
      `Chi nhánh: ${meta.branchLabel || 'Tất cả chi nhánh'}`,
      ...(meta.modeLabel ? [`Chế độ: ${meta.modeLabel}`] : []),
    ],
  );

  const chartsRow = writeKpiCards(dashboard, nextRow, kpis);
  const dataRow = chartsRow;

  // 3. Vùng dữ liệu ngầm cho biểu đồ (Columns R+ / DASHBOARD_DATA_START_COL)
  const groupTableCol = DASHBOARD_DATA_START_COL;
  const groupCompareCol = groupTableCol + 4;
  const agingTableCol = groupCompareCol + 6;
  const topCustCol = agingTableCol + 4;

  // Bảng 1: Cơ cấu doanh thu theo nhóm
  const rawGroupRows: [string, number][] = [
    ['KH Doanh nghiệp', enterpriseSec?.totalAmount || 0],
    ['KH Cá nhân', individualSec?.totalAmount || 0],
    ['Bảo hiểm', insuranceSec?.totalAmount || 0],
  ];
  const groupRows = rawGroupRows.filter((r) => r[1] > 0);

  // Bảng 2: So sánh thu hồi nợ từng nhóm
  const compareRows: [string, number, number, number][] = [
    [
      'KH Doanh nghiệp',
      enterpriseSec?.totalAmount || 0,
      enterpriseSec?.paidAmount || 0,
      enterpriseSec?.balanceAmount || 0,
    ],
    [
      'KH Cá nhân',
      individualSec?.totalAmount || 0,
      individualSec?.paidAmount || 0,
      individualSec?.balanceAmount || 0,
    ],
    [
      'Bảo hiểm',
      insuranceSec?.totalAmount || 0,
      insuranceSec?.paidAmount || 0,
      insuranceSec?.balanceAmount || 0,
    ],
  ];

  // Bảng 3: Cơ cấu tuổi nợ
  const allCases: GarageDebtCaseExportRow[] = [];
  customerSections.forEach((s) => allCases.push(...s.cases));

  const totalA0_30 = sumOfCases(allCases, (c) => c.aging0_30);
  const totalA31_60 = sumOfCases(allCases, (c) => c.aging31_60);
  const totalA61_90 = sumOfCases(allCases, (c) => c.aging61_90);
  const totalAOver90 = sumOfCases(allCases, (c) => c.agingOver90);

  const agingRows: [string, number][] = [
    ['0-30 ngày', totalA0_30],
    ['31-60 ngày', totalA31_60],
    ['61-90 ngày', totalA61_90],
    ['Trên 90 ngày', totalAOver90],
  ];

  // Bảng 4: Top 10 khách hàng còn nợ lớn nhất
  const topCases = allCases
    .filter((c) => (c.balanceAmount || 0) > 0)
    .sort((a, b) => b.balanceAmount - a.balanceAmount)
    .slice(0, TOP_N);

  const topRows: [string, number][] = topCases.map((c) => {
    const plate = c.bienSoXe || '(Chưa BKS)';
    return [shorten(`${plate} - ${c.partnerTitle}`), c.balanceAmount];
  });

  const groupTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: groupTableCol,
    columnWidths: [24, 16],
    title: 'Dữ liệu biểu đồ: Cơ cấu doanh thu theo nhóm',
    headers: ['Nhóm đối tượng', 'Phát sinh'],
    rows: groupRows.length > 0 ? groupRows : [['Không có dữ liệu', 0]],
    numFmts: [undefined, MONEY],
  });

  const compareTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: groupCompareCol,
    columnWidths: [24, 16, 16, 16],
    title: 'Dữ liệu biểu đồ: So sánh Thu hồi nợ từng nhóm',
    headers: ['Nhóm đối tượng', 'Phát sinh', 'Đã thu', 'Còn nợ'],
    rows: compareRows,
    numFmts: [undefined, MONEY, MONEY, MONEY],
  });

  const agingTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: agingTableCol,
    columnWidths: [20, 16],
    title: 'Dữ liệu biểu đồ: Cơ cấu tuổi nợ',
    headers: ['Khoảng tuổi nợ', 'Giá trị nợ'],
    rows: agingRows,
    numFmts: [undefined, MONEY],
  });

  const topCustTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: topCustCol,
    columnWidths: [36, 16],
    title: `Dữ liệu biểu đồ: Top ${TOP_N} khách hàng còn nợ`,
    headers: ['Biển số - Khách hàng', 'Còn nợ'],
    rows: topRows.length > 0 ? topRows : [['Không có dữ liệu', 0]],
    numFmts: [undefined, MONEY],
  });

  // 4. Khởi tạo 4 Biểu đồ (Grid 2x2 trong vùng in A–P)
  const charts: XlsxChartSpec[] = [];

  // Chart 1: Doughnut - Cơ cấu doanh thu theo nhóm đối tượng
  if (groupRows.length > 0) {
    charts.push({
      type: 'doughnut',
      title: 'Cơ cấu doanh thu theo Nhóm đối tượng',
      anchor: chartAnchor(chartsRow, 0),
      categoriesRef: groupTable.ref(0),
      categories: groupRows.map((r) => r[0]),
      series: [
        {
          name: 'Phát sinh',
          valuesRef: groupTable.ref(1),
          values: groupRows.map((r) => r[1]),
          color: CHART_PALETTE[0],
        },
      ],
      pointColors: [CHART_PALETTE[0], CHART_PALETTE[1], CHART_PALETTE[4]],
      dataLabels: true,
    });
  }

  // Chart 2: Clustered Column - So sánh Thu hồi nợ từng nhóm
  charts.push({
    type: 'column',
    title: 'So sánh Thu hồi nợ từng nhóm',
    anchor: chartAnchor(chartsRow, 1),
    categoriesRef: compareTable.ref(0),
    categories: compareRows.map((r) => r[0]),
    series: [
      {
        name: 'Phát sinh',
        valuesRef: compareTable.ref(1),
        values: compareRows.map((r) => r[1]),
        color: CHART_PALETTE[0],
      },
      {
        name: 'Đã thu',
        valuesRef: compareTable.ref(2),
        values: compareRows.map((r) => r[2]),
        color: CHART_PALETTE[1],
      },
      {
        name: 'Còn nợ',
        valuesRef: compareTable.ref(3),
        values: compareRows.map((r) => r[3]),
        color: CHART_PALETTE[3],
      },
    ],
  });

  // Chart 3: Doughnut - Cơ cấu tuổi nợ
  charts.push({
    type: 'doughnut',
    title: 'Cơ cấu tuổi nợ toàn hệ thống',
    anchor: chartAnchor(chartsRow, 2),
    categoriesRef: agingTable.ref(0),
    categories: agingRows.map((r) => r[0]),
    series: [
      {
        name: 'Giá trị nợ',
        valuesRef: agingTable.ref(1),
        values: agingRows.map((r) => r[1]),
        color: CHART_PALETTE[0],
      },
    ],
    pointColors: ['059669', 'D97706', 'EA580C', 'E11D48'],
    dataLabels: true,
  });

  // Chart 4: Bar - Top 10 khách hàng còn nợ lớn nhất
  if (topRows.length > 0) {
    charts.push({
      type: 'bar',
      title: `Top ${TOP_N} khách hàng còn nợ lớn nhất`,
      anchor: chartAnchor(chartsRow, 3),
      categoriesRef: topCustTable.ref(0),
      categories: topRows.map((r) => r[0]),
      series: [
        {
          name: 'Còn phải thu',
          valuesRef: topCustTable.ref(1),
          values: topRows.map((r) => r[1]),
          color: CHART_PALETTE[3],
        },
      ],
      dataLabels: true,
      reverseCategories: true,
    });
  }

  // 5. Bảng tóm tắt chỉ số ngay dưới các biểu đồ (Grid 2 hàng charts => 2 * (16 + 1))
  const endSummaryRow = renderGroupSummaryTables(
    dashboard,
    rowAfterCharts(chartsRow, 2),
    meta,
  );
  setDashboardPrintArea(dashboard, endSummaryRow);

  return charts;
}

/**
 * Dựng file công nợ: sheet 1 `Dashboard` (KPI + chart gốc Excel + bảng chỉ số group),
 * các sheet tiếp theo tách riêng cho từng nhóm đối tượng hoặc phẳng.
 */
export async function buildGarageDebtReport(
  kind: GarageDebtExportKind,
  rows: GarageDebtExportRow[],
  meta: GarageDebtReportMeta = {},
  sections?: GarageDebtGroupExportSection[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Liouni ERP';
  workbook.lastModifiedBy = 'Liouni ERP';
  workbook.created = new Date();

  const dashboard = createDashboardSheet(workbook, DEBT_DASHBOARD_SHEET);

  let charts: XlsxChartSpec[] = [];

  if (sections && sections.length > 0) {
    // Tách mỗi group thành một sheet riêng độc lập, triệt tiêu double sum
    sections.forEach((sec) => {
      if (sec.cases.length === 0 && sec.totalAmount === 0) return;
      buildSingleGroupDebtSheet(
        workbook,
        sec.title,
        sec,
        GARAGE_DEBT_CASE_COLUMNS,
      );
    });

    charts = buildGroupedDebtDashboard(dashboard, sections, [], meta, kind);
  } else {
    buildDebtDetailSheet(workbook, kind, rows);
    charts = buildDebtDashboard(dashboard, kind, rows, meta);
    const endSummaryRow = renderGroupSummaryTables(
      dashboard,
      rowAfterCharts(charts.length > 0 ? 9 : 9, 2),
      meta,
    );
    setDashboardPrintArea(dashboard, endSummaryRow);
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return injectCharts(buffer, DEBT_DASHBOARD_SHEET, charts);
}

function buildAllDebtsDashboard(
  dashboard: ExcelJS.Worksheet,
  customerRows: GarageDebtExportRow[],
  supplierRows: GarageDebtExportRow[],
  meta: GarageDebtReportMeta,
): XlsxChartSpec[] {
  const custConfig = GARAGE_DEBT_EXPORT_CONFIG.customers;
  const suppConfig = GARAGE_DEBT_EXPORT_CONFIG.suppliers;

  const custDetail = `'${custConfig.sheetName.replace(/'/g, "''")}'`;
  const suppDetail = `'${suppConfig.sheetName.replace(/'/g, "''")}'`;

  const custLastRow = DETAIL_FIRST_ROW + Math.max(customerRows.length, 1) - 1;
  const suppLastRow = DETAIL_FIRST_ROW + Math.max(supplierRows.length, 1) - 1;

  const custCol = (key: string) => {
    const index = custConfig.columns.findIndex((c) => c.key === key);
    return `${custDetail}!${columnLetter(index + 1)}${DETAIL_FIRST_ROW}:${columnLetter(index + 1)}${custLastRow}`;
  };

  const suppCol = (key: string) => {
    const index = suppConfig.columns.findIndex((c) => c.key === key);
    return `${suppDetail}!${columnLetter(index + 1)}${DETAIL_FIRST_ROW}:${columnLetter(index + 1)}${suppLastRow}`;
  };

  const totalCust = sumOf(customerRows, (r) => r.totalAmount);
  const paidCust = sumOf(customerRows, (r) => r.paidAmount);
  const balanceCust = sumOf(customerRows, (r) => r.balanceAmount);

  const totalSupp = sumOf(supplierRows, (r) => r.totalAmount);
  const paidSupp = sumOf(supplierRows, (r) => r.paidAmount);
  const balanceSupp = sumOf(supplierRows, (r) => r.balanceAmount);

  const netDebt = balanceCust - balanceSupp;

  const kpis: DashboardKpi[] = [
    {
      label: 'TỔNG PHẢI THU (KHÁCH HÀNG)',
      value: { formula: `SUM(${custCol('totalAmount')})`, result: totalCust },
    },
    {
      label: 'CÒN PHẢI THU (KHÁCH HÀNG)',
      value: {
        formula: `SUM(${custCol('balanceAmount')})`,
        result: balanceCust,
      },
    },
    {
      label: 'TỔNG PHẢI TRẢ (NHÀ CUNG CẤP)',
      value: { formula: `SUM(${suppCol('totalAmount')})`, result: totalSupp },
    },
    {
      label: 'CÒN PHẢI TRẢ (NHÀ CUNG CẤP)',
      value: {
        formula: `SUM(${suppCol('balanceAmount')})`,
        result: balanceSupp,
      },
    },
    {
      label: 'CÔNG NỢ RÒNG (PHẢI THU - TRẢ)',
      value: {
        formula: `SUM(${custCol('balanceAmount')})-SUM(${suppCol('balanceAmount')})`,
        result: netDebt,
      },
    },
    {
      label: 'SỐ LƯỢNG KHÁCH HÀNG',
      value: customerRows.length,
    },
    {
      label: 'SỐ LƯỢNG NHÀ CUNG CẤP',
      value: supplierRows.length,
    },
    {
      label: 'TỶ LỆ THU HỒI CÔNG NỢ KH',
      value: {
        formula: `IF(SUM(${custCol('totalAmount')})=0,0,SUM(${custCol('paidAmount')})/SUM(${custCol('totalAmount')}))`,
        result: totalCust === 0 ? 0 : paidCust / totalCust,
      },
      numFmt: '0.0%',
    },
  ];

  const nextRow = writeDashboardHeader(
    dashboard,
    'Dashboard tổng hợp công nợ garage (Phải thu & Phải trả)',
    [
      formatPeriod(meta),
      `Chi nhánh: ${meta.branchLabel || 'Tất cả chi nhánh'}`,
      ...(meta.modeLabel ? [`Chế độ: ${meta.modeLabel}`] : []),
    ],
  );

  const chartsRow = writeKpiCards(dashboard, nextRow, kpis);
  const dataRow = chartsRow;
  setDashboardPrintArea(dashboard, rowAfterCharts(chartsRow, 2));

  const custTopCol = DASHBOARD_DATA_START_COL;
  const suppTopCol = custTopCol + 4;

  const topCust = topDebtRows(customerRows);
  const topCustTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: custTopCol,
    columnWidths: [40, 16, 16],
    title: `Dữ liệu biểu đồ: Top ${TOP_N} khách hàng còn nợ`,
    headers: ['Biển số - Khách hàng', 'Còn nợ', 'Đã trả'],
    rows: topCust.map((r) => [debtRowLabel(r), r.balanceAmount, r.paidAmount]),
    numFmts: [undefined, MONEY, MONEY],
  });

  const topSupp = topDebtRows(supplierRows);
  const topSuppTable = writeDataTable(dashboard, {
    startRow: dataRow,
    startCol: suppTopCol,
    columnWidths: [40, 16, 16],
    title: `Dữ liệu biểu đồ: Top ${TOP_N} nhà cung cấp còn phải trả`,
    headers: ['Biển số - Nhà cung cấp', 'Còn phải trả', 'Đã trả'],
    rows: topSupp.map((r) => [debtRowLabel(r), r.balanceAmount, r.paidAmount]),
    numFmts: [undefined, MONEY, MONEY],
  });

  const charts: XlsxChartSpec[] = [];

  if (topCust.length > 0) {
    charts.push({
      type: 'bar',
      title: `Top ${TOP_N} khách hàng còn nợ lớn nhất`,
      anchor: chartAnchor(chartsRow, 0),
      categoriesRef: topCustTable.ref(0),
      categories: topCust.map(debtRowLabel),
      series: [
        {
          name: 'Còn phải thu',
          valuesRef: topCustTable.ref(1),
          values: topCust.map((r) => r.balanceAmount),
          color: CHART_PALETTE[3],
        },
      ],
      dataLabels: true,
      reverseCategories: true,
    });
  }

  if (topSupp.length > 0) {
    charts.push({
      type: 'bar',
      title: `Top ${TOP_N} nhà cung cấp còn phải trả lớn nhất`,
      anchor: chartAnchor(chartsRow, 1),
      categoriesRef: topSuppTable.ref(0),
      categories: topSupp.map(debtRowLabel),
      series: [
        {
          name: 'Còn phải trả',
          valuesRef: topSuppTable.ref(1),
          values: topSupp.map((r) => r.balanceAmount),
          color: CHART_PALETTE[0],
        },
      ],
      dataLabels: true,
      reverseCategories: true,
    });
  }

  // Vẽ các bảng chỉ số theo group ngay dưới các biểu đồ
  const endSummaryRow = renderGroupSummaryTables(
    dashboard,
    rowAfterCharts(chartsRow, 2),
    meta,
  );
  setDashboardPrintArea(dashboard, endSummaryRow);

  return charts;
}

/**
 * Dựng file tổng hợp công nợ gồm nhiều sheet:
 * Sheet 1: Dashboard tổng quan (8 KPI, 4 Biểu đồ phân nhóm, bảng chỉ số)
 * Các sheet tiếp theo: Chi tiết từng nhóm khách hàng (tách riêng từng sheet)
 * Sheet cuối: Công nợ phải trả (chi tiết nhà cung cấp)
 */
export async function buildGarageAllDebtsReport(
  customerRows: GarageDebtExportRow[],
  supplierRows: GarageDebtExportRow[],
  meta: GarageDebtReportMeta = {},
  customerSections?: GarageDebtGroupExportSection[],
  supplierSections?: GarageDebtGroupExportSection[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Liouni ERP';
  workbook.lastModifiedBy = 'Liouni ERP';
  workbook.created = new Date();

  const dashboard = createDashboardSheet(workbook, DEBT_DASHBOARD_SHEET);

  if (customerSections && customerSections.length > 0) {
    // Tách mỗi nhóm thành 1 sheet riêng độc lập
    customerSections.forEach((sec) => {
      if (sec.cases.length === 0 && sec.totalAmount === 0) return;
      buildSingleGroupDebtSheet(
        workbook,
        sec.title,
        sec,
        GARAGE_DEBT_CASE_COLUMNS,
      );
    });
  } else {
    buildDebtDetailSheet(workbook, 'customers', customerRows);
  }

  if (supplierSections && supplierSections.length > 0) {
    supplierSections.forEach((sec) => {
      if (sec.cases.length === 0 && sec.totalAmount === 0) return;
      buildSingleGroupDebtSheet(
        workbook,
        sec.title,
        sec,
        GARAGE_DEBT_CASE_COLUMNS,
      );
    });
  } else {
    buildDebtDetailSheet(workbook, 'suppliers', supplierRows);
  }

  const charts =
    customerSections && customerSections.length > 0
      ? buildGroupedDebtDashboard(
          dashboard,
          customerSections,
          supplierRows,
          meta,
          'all',
        )
      : buildAllDebtsDashboard(dashboard, customerRows, supplierRows, meta);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return injectCharts(buffer, DEBT_DASHBOARD_SHEET, charts);
}
