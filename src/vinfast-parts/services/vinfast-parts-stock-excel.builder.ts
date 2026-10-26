import { BadRequestException } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { toVietnamExcelDate } from '../../common/utils/date.util';

type Align = 'left' | 'center' | 'right';

export interface StockColumnDef {
  key: string;
  header: string;
  width: number;
  align: Align;
  numFmt?: string;
  sum?: boolean;
}

export interface VinfastPartsStockExcelInput {
  overviewItems: Array<Record<string, any>>;
  ledgerSections: Array<{
    sku: string;
    partName: string;
    vehicleType?: string;
    rows: any[];
  }>;
  selectedColumns?: string[];
  periodInfo?: {
    dateFrom?: string;
    dateTo?: string;
    vehicleType?: string;
    exportedAt?: Date;
  };
}

export const QTY_FMT = '#,##0';
export const MONEY_FMT = '#,##0.00';
export const DATE_FMT = 'dd/mm/yyyy';

export const HEADER_ROW = 6;
export const DATA_START_ROW = 7;

export const COLOR = {
  border: 'FFE2E8F0',
  totalFill: 'FFFFFBEB',
  totalFont: 'FF78350F',
  subtotalFill: 'FFF8FAFC',
  subtotalFont: 'FF475569',
  invoiceFill: 'FFF0FDF4',
  invoiceHeader: 'FF065F46',
  headerFill: 'FF334155',
  darkText: 'FF0F172A',
  white: 'FFFFFFFF',
};

export const INVOICE_KEYS = new Set([
  'invoiceBranchName',
  'invoiceDate',
  'invoiceNo',
  'invoiceSerial',
  'invoiceTaxCode',
  'invoicePartner',
  'invoiceItemName',
  'invoiceItemQty',
  'invoiceItemUnitPrice',
  'invoiceItemVatRate',
  'invoiceItemTotalAmount',
]);

export const BORDER_THIN = {
  top: { style: 'thin' as const, color: { argb: COLOR.border } },
  bottom: { style: 'thin' as const, color: { argb: COLOR.border } },
  left: { style: 'thin' as const, color: { argb: COLOR.border } },
  right: { style: 'thin' as const, color: { argb: COLOR.border } },
};

export const SOLID = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb },
});

export const VINFAST_STOCK_SUMMARY_COLUMNS: StockColumnDef[] = [
  { key: 'stt', header: 'STT', width: 8, align: 'center' },
  { key: 'sku', header: 'Mã Phụ Tùng', width: 22, align: 'left' },
  { key: 'name', header: 'Tên Phụ Tùng', width: 35, align: 'left' },
  { key: 'uom', header: 'ĐVT', width: 12, align: 'center' },
  { key: 'vehicleType', header: 'Loại Xe', width: 14, align: 'center' },
  {
    key: 'qtyOpening',
    header: 'Tồn Đầu Kỳ',
    width: 16,
    align: 'right',
    numFmt: QTY_FMT,
    sum: true,
  },
  {
    key: 'qtyIn',
    header: 'Tổng Nhập',
    width: 16,
    align: 'right',
    numFmt: QTY_FMT,
    sum: true,
  },
  {
    key: 'qtyOut',
    header: 'Tổng Xuất',
    width: 16,
    align: 'right',
    numFmt: QTY_FMT,
    sum: true,
  },
  {
    key: 'qtyBalance',
    header: 'Tồn Cuối Kỳ',
    width: 16,
    align: 'right',
    numFmt: QTY_FMT,
    sum: true,
  },
];

export const VINFAST_STOCK_LEDGER_COLUMNS: StockColumnDef[] = [
  { key: 'partSku', header: 'Mã Phụ Tùng', width: 22, align: 'left' },
  { key: 'partName', header: 'Tên Phụ Tùng', width: 30, align: 'left' },
  { key: 'vehicleType', header: 'Loại Xe', width: 14, align: 'center' },
  {
    key: 'transactionDate',
    header: 'Ngày Giao Dịch',
    width: 15,
    align: 'center',
    numFmt: DATE_FMT,
  },
  { key: 'direction', header: 'Chiều', width: 10, align: 'center' },
  {
    key: 'qty',
    header: 'Số Lượng',
    width: 14,
    align: 'right',
    numFmt: QTY_FMT,
  },
  {
    key: 'unitCost',
    header: 'Đơn Giá',
    width: 16,
    align: 'right',
    numFmt: MONEY_FMT,
  },
  {
    key: 'amount',
    header: 'Thành Tiền',
    width: 18,
    align: 'right',
    numFmt: MONEY_FMT,
    sum: true,
  },
  { key: 'licensePlate', header: 'Biển Số Xe', width: 15, align: 'center' },
  {
    key: 'runningBalanceQty',
    header: 'Tồn Lũy Kế',
    width: 16,
    align: 'right',
    numFmt: QTY_FMT,
  },
  {
    key: 'runningBalanceValue',
    header: 'Giá Trị Tồn Lũy Kế',
    width: 20,
    align: 'right',
    numFmt: MONEY_FMT,
  },
  // Khối cột hóa đơn cấn trừ chi tiết
  {
    key: 'invoiceBranchName',
    header: '[HĐ] Chi nhánh',
    width: 24,
    align: 'center',
  },
  {
    key: 'invoiceDate',
    header: '[HĐ] Ngày HĐ',
    width: 16,
    align: 'center',
    numFmt: DATE_FMT,
  },
  {
    key: 'invoiceNo',
    header: '[HĐ] Số HĐ',
    width: 18,
    align: 'center',
  },
  {
    key: 'invoiceSerial',
    header: '[HĐ] Ký hiệu HĐ',
    width: 16,
    align: 'center',
  },
  {
    key: 'invoiceTaxCode',
    header: '[HĐ] MST HĐ',
    width: 18,
    align: 'center',
  },
  {
    key: 'invoicePartner',
    header: '[HĐ] Đối tác HĐ',
    width: 36,
    align: 'left',
  },
  {
    key: 'invoiceItemName',
    header: '[HĐ] Tên dòng hàng',
    width: 35,
    align: 'left',
  },
  {
    key: 'invoiceItemQty',
    header: '[HĐ] SL HĐ',
    width: 14,
    align: 'right',
    numFmt: QTY_FMT,
  },
  {
    key: 'invoiceItemUnitPrice',
    header: '[HĐ] Đơn giá HĐ (VND)',
    width: 18,
    align: 'right',
    numFmt: MONEY_FMT,
  },
  {
    key: 'invoiceItemVatRate',
    header: '[HĐ] Thuế VAT (%)',
    width: 14,
    align: 'center',
  },
  {
    key: 'invoiceItemTotalAmount',
    header: '[HĐ] Thành tiền HĐ (VND)',
    width: 22,
    align: 'right',
    numFmt: MONEY_FMT,
    sum: true,
  },
];

const ALLOWED_COLUMN_KEYS = new Set([
  ...VINFAST_STOCK_SUMMARY_COLUMNS.map((c) => c.key),
  ...VINFAST_STOCK_LEDGER_COLUMNS.map((c) => c.key),
  'qtyClosing',
  'serialNo',
]);

export function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/** Trả `undefined` khi không chọn (= xuất đủ cột). Ném 400 nếu có key lạ. */
export function parseSelectedColumns(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const invalid = raw.filter(
    (key) => typeof key !== 'string' || !ALLOWED_COLUMN_KEYS.has(key),
  );
  if (invalid.length > 0) {
    throw new BadRequestException(
      `Cột xuất không hợp lệ: ${invalid.join(', ')}`,
    );
  }
  return raw as string[];
}

function resolveColumns(
  all: StockColumnDef[],
  selected?: string[],
): StockColumnDef[] {
  if (!selected) return all;
  return all.filter((c) => {
    if (selected.includes(c.key)) return true;
    if (c.key === 'qtyBalance' && selected.includes('qtyClosing')) return true;
    if (c.key === 'invoiceSerial' && selected.includes('serialNo')) return true;
    return false;
  });
}

function toCellValue(value: unknown): unknown {
  return value === null || value === undefined ? '' : value;
}

function summaryRows(items: Array<Record<string, any>>) {
  return items.map((item, idx) => ({
    stt: idx + 1,
    sku: item.sku,
    name: item.name,
    uom: item.uom,
    vehicleType: item.vehicleType || '',
    qtyOpening: Number(item.qtyOpening || 0),
    qtyIn: Number(item.qtyIn || 0),
    qtyOut: Number(item.qtyOut || 0),
    qtyBalance: Number(item.qtyBalance ?? item.qtyClosing ?? 0),
  }));
}

function ledgerRows(sections: VinfastPartsStockExcelInput['ledgerSections']) {
  return sections.flatMap((section) =>
    section.rows.map((row) => ({
      partSku: section.sku,
      partName: section.partName,
      vehicleType: row.vehicleType || section.vehicleType || '',
      transactionDate: toVietnamExcelDate(row.transactionDate) ?? '',
      direction:
        row.direction === 'IN' || row.direction === 'Nhập' ? 'Nhập' : 'Xuất',
      qty: Number(row.qty || 0),
      unitCost: Number(row.unitCost || 0),
      amount: Number(row.preVatAmount || 0),
      licensePlate: row.licensePlate || '',
      runningBalanceQty: row.runningBalanceQty,
      runningBalanceValue: row.runningBalanceValue,
      invoiceBranchName: row.invoiceBranchName || '',
      invoiceDate: toVietnamExcelDate(row.invoiceDate) ?? '',
      invoiceNo: row.invoiceNo || '',
      invoiceSerial: row.invoiceSerial || row.serialNo || '',
      invoiceTaxCode: row.invoiceTaxCode || '',
      invoicePartner: row.invoicePartner || '',
      invoiceItemName: row.invoiceItemName || '',
      invoiceItemQty:
        row.invoiceItemQty != null && row.invoiceItemQty !== ''
          ? Number(row.invoiceItemQty)
          : '',
      invoiceItemUnitPrice:
        row.invoiceItemUnitPrice != null && row.invoiceItemUnitPrice !== ''
          ? Number(row.invoiceItemUnitPrice)
          : '',
      invoiceItemVatRate: row.invoiceItemVatRate || '',
      invoiceItemTotalAmount:
        row.invoiceItemTotalAmount != null && row.invoiceItemTotalAmount !== ''
          ? Number(row.invoiceItemTotalAmount)
          : '',
    })),
  );
}

function formatDisplayDate(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(d);
}

function formatPeriodText(
  periodInfo?: VinfastPartsStockExcelInput['periodInfo'],
): string {
  if (!periodInfo) return 'Kỳ báo cáo: Toàn bộ thời gian';
  const { dateFrom, dateTo } = periodInfo;
  if (dateFrom && dateTo) {
    return `Kỳ báo cáo: Từ ngày ${formatDisplayDate(dateFrom)} đến ngày ${formatDisplayDate(dateTo)}`;
  }
  if (dateFrom) {
    return `Kỳ báo cáo: Từ ngày ${formatDisplayDate(dateFrom)}`;
  }
  if (dateTo) {
    return `Kỳ báo cáo: Đến ngày ${formatDisplayDate(dateTo)}`;
  }
  return 'Kỳ báo cáo: Toàn bộ thời gian';
}

function formatVehicleText(vehicleType?: string): string {
  if (vehicleType === 'oto' || vehicleType === 'CAR') return 'Phân loại: Ô tô';
  if (vehicleType === 'xemay' || vehicleType === 'MOTORBIKE')
    return 'Phân loại: Xe máy';
  return 'Phân loại: Tất cả phương tiện';
}

interface SheetWriteOptions {
  periodInfo?: VinfastPartsStockExcelInput['periodInfo'];
  ledgerDefs?: StockColumnDef[];
  ledgerRowCount?: number;
}

function writeSheet(
  workbook: Workbook,
  name: string,
  defs: StockColumnDef[],
  rows: Record<string, any>[],
  options?: SheetWriteOptions,
): void {
  const sheet: Worksheet = workbook.addWorksheet(name);
  sheet.columns = defs.map((d) => ({ key: d.key, width: d.width }));

  for (let i = 0; i < HEADER_ROW; i++) sheet.addRow([]);

  const dataEnd = DATA_START_ROW + rows.length - 1;
  const isSummarySheet = name === 'Tổng Hợp Tồn Kho';

  // Banner Row 1: Tiêu đề
  const titleRow = sheet.getRow(1);
  titleRow.height = 24;
  const titleCell = titleRow.getCell(1);
  titleCell.value = name.toUpperCase();
  titleCell.font = {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: COLOR.darkText },
  };

  // Banner Row 2: Diễn giải kỳ
  const descRow = sheet.getRow(2);
  descRow.height = 20;
  const descCell = descRow.getCell(1);
  descCell.value = `${formatPeriodText(options?.periodInfo)} | ${formatVehicleText(options?.periodInfo?.vehicleType)}`;
  descCell.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: COLOR.subtotalFont },
  };

  // Row 3: TỔNG, Row 4: SUBTOTAL
  const totalRow = sheet.getRow(3);
  const subRow = sheet.getRow(4);
  totalRow.height = 20;
  subRow.height = 20;
  sheet.getRow(5).height = 8; // Spacer

  totalRow.font = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: COLOR.totalFont },
  };
  subRow.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: COLOR.subtotalFont },
  };

  defs.forEach((d, i) => {
    const col = i + 1;
    const letter = sheet.getColumn(col).letter;
    const totalCell = totalRow.getCell(col);
    const subCell = subRow.getCell(col);

    totalCell.fill = SOLID(COLOR.totalFill);
    subCell.fill = SOLID(COLOR.subtotalFill);
    totalCell.border = BORDER_THIN;
    subCell.border = BORDER_THIN;

    if (i === 0) {
      totalCell.value = 'TỔNG';
      subCell.value = 'SUBTOTAL (theo bộ lọc)';
    }
    if (d.sum) {
      const sumVal = rows.reduce((s, r) => s + (Number(r[d.key]) || 0), 0);
      const range = `${letter}${DATA_START_ROW}:${letter}${dataEnd}`;
      totalCell.value = rows.length
        ? { formula: `SUM(${range})`, result: sumVal }
        : 0;
      subCell.value = rows.length
        ? { formula: `SUBTOTAL(9,${range})`, result: sumVal }
        : 0;
      totalCell.numFmt = d.numFmt ?? MONEY_FMT;
      subCell.numFmt = d.numFmt ?? MONEY_FMT;
      totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
      subCell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  // Row 6: Header bảng
  const headerRow = sheet.getRow(HEADER_ROW);
  headerRow.height = 26;
  defs.forEach((d, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = d.header;
    const isInvoiceCol = INVOICE_KEYS.has(d.key);
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: COLOR.white },
    };
    cell.fill = SOLID(isInvoiceCol ? COLOR.invoiceHeader : COLOR.headerFill);
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = BORDER_THIN;
  });

  // Tìm vị trí các cột trong Sheet Tổng Hợp
  const colIdxSku = defs.findIndex((c) => c.key === 'sku');
  const colIdxOpening = defs.findIndex((c) => c.key === 'qtyOpening');
  const colIdxIn = defs.findIndex((c) => c.key === 'qtyIn');
  const colIdxOut = defs.findIndex((c) => c.key === 'qtyOut');
  const colIdxBalance = defs.findIndex((c) => c.key === 'qtyBalance');

  // Tìm vị trí các cột trong Sheet Sổ Cái Chi Tiết FIFO
  const ledgerDefs = options?.ledgerDefs || [];
  const ledgerRowCount = options?.ledgerRowCount || 0;
  const ledgerSkuIdx = ledgerDefs.findIndex((c) => c.key === 'partSku');
  const ledgerDirIdx = ledgerDefs.findIndex((c) => c.key === 'direction');
  const ledgerQtyIdx = ledgerDefs.findIndex((c) => c.key === 'qty');
  const ledgerEndRow = DATA_START_ROW + ledgerRowCount - 1;

  const canUseLedgerFormulas =
    isSummarySheet &&
    ledgerRowCount > 0 &&
    colIdxSku >= 0 &&
    ledgerSkuIdx >= 0 &&
    ledgerDirIdx >= 0 &&
    ledgerQtyIdx >= 0;

  const skuColLetter = colIdxSku >= 0 ? getColumnLetter(colIdxSku + 1) : '';
  const openingColLetter =
    colIdxOpening >= 0 ? getColumnLetter(colIdxOpening + 1) : '';
  const inColLetter = colIdxIn >= 0 ? getColumnLetter(colIdxIn + 1) : '';
  const outColLetter = colIdxOut >= 0 ? getColumnLetter(colIdxOut + 1) : '';

  const ledgerSkuLetter =
    ledgerSkuIdx >= 0 ? getColumnLetter(ledgerSkuIdx + 1) : '';
  const ledgerDirLetter =
    ledgerDirIdx >= 0 ? getColumnLetter(ledgerDirIdx + 1) : '';
  const ledgerQtyLetter =
    ledgerQtyIdx >= 0 ? getColumnLetter(ledgerQtyIdx + 1) : '';

  // Row 7+: Dữ liệu
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const currentRowNumber = DATA_START_ROW + rIdx;
    const dataRow = sheet.addRow(defs.map((d) => toCellValue(row[d.key])));
    dataRow.height = 20;
    dataRow.font = { name: 'Calibri', size: 10 };

    defs.forEach((d, i) => {
      const cell = dataRow.getCell(i + 1);
      const isInvoiceCol = INVOICE_KEYS.has(d.key);
      const isFirstInvCol =
        isInvoiceCol && (i === 0 || !INVOICE_KEYS.has(defs[i - 1].key));

      cell.alignment = { horizontal: d.align, vertical: 'middle' };
      if (isInvoiceCol) {
        cell.fill = SOLID(COLOR.invoiceFill);
      }
      cell.border = isFirstInvCol
        ? {
            ...BORDER_THIN,
            left: { style: 'double', color: { argb: COLOR.invoiceHeader } },
          }
        : BORDER_THIN;

      if (d.numFmt) cell.numFmt = d.numFmt;

      // ── Áp dụng công thức Excel trong Sheet Tổng Hợp ──
      if (isSummarySheet) {
        if (d.key === 'qtyIn' && canUseLedgerFormulas) {
          cell.value = {
            formula: `SUMIFS('Sổ Cái Chi Tiết FIFO'!$${ledgerQtyLetter}$${DATA_START_ROW}:$${ledgerQtyLetter}$${ledgerEndRow}, 'Sổ Cái Chi Tiết FIFO'!$${ledgerSkuLetter}$${DATA_START_ROW}:$${ledgerSkuLetter}$${ledgerEndRow}, ${skuColLetter}${currentRowNumber}, 'Sổ Cái Chi Tiết FIFO'!$${ledgerDirLetter}$${DATA_START_ROW}:$${ledgerDirLetter}$${ledgerEndRow}, "Nhập")`,
            result: Number(row.qtyIn || 0),
          };
        } else if (d.key === 'qtyOut' && canUseLedgerFormulas) {
          cell.value = {
            formula: `SUMIFS('Sổ Cái Chi Tiết FIFO'!$${ledgerQtyLetter}$${DATA_START_ROW}:$${ledgerQtyLetter}$${ledgerEndRow}, 'Sổ Cái Chi Tiết FIFO'!$${ledgerSkuLetter}$${DATA_START_ROW}:$${ledgerSkuLetter}$${ledgerEndRow}, ${skuColLetter}${currentRowNumber}, 'Sổ Cái Chi Tiết FIFO'!$${ledgerDirLetter}$${DATA_START_ROW}:$${ledgerDirLetter}$${ledgerEndRow}, "Xuất")`,
            result: Number(row.qtyOut || 0),
          };
        } else if (
          d.key === 'qtyBalance' &&
          openingColLetter &&
          inColLetter &&
          outColLetter
        ) {
          cell.value = {
            formula: `${openingColLetter}${currentRowNumber}+${inColLetter}${currentRowNumber}-${outColLetter}${currentRowNumber}`,
            result: Number(row.qtyBalance ?? row.qtyClosing ?? 0),
          };
        }
      }
    });
  }

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: dataEnd, column: defs.length },
    };
  }
}

export async function buildVinfastPartsStockWorkbook(
  input: VinfastPartsStockExcelInput,
): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'ERP';

  const summaryDefs = resolveColumns(
    VINFAST_STOCK_SUMMARY_COLUMNS,
    input.selectedColumns,
  );
  const ledgerDefs = resolveColumns(
    VINFAST_STOCK_LEDGER_COLUMNS,
    input.selectedColumns,
  );

  const lRows = ledgerRows(input.ledgerSections);
  const sRows = summaryRows(input.overviewItems);

  if (summaryDefs.length > 0) {
    writeSheet(workbook, 'Tổng Hợp Tồn Kho', summaryDefs, sRows, {
      periodInfo: input.periodInfo,
      ledgerDefs,
      ledgerRowCount: lRows.length,
    });
  }
  if (ledgerDefs.length > 0) {
    writeSheet(workbook, 'Sổ Cái Chi Tiết FIFO', ledgerDefs, lRows, {
      periodInfo: input.periodInfo,
    });
  }
  if (workbook.worksheets.length === 0) {
    throw new BadRequestException('Chưa chọn cột nào để xuất.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
}
