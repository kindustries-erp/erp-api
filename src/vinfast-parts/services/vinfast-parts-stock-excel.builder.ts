import { BadRequestException } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { toVietnamExcelDate } from '../../common/utils/date.util';

type Align = 'left' | 'center' | 'right';

interface StockColumnDef {
  key: string;
  header: string;
  width: number;
  align: Align;
  numFmt?: string;
  sum?: boolean;
}

export interface VinfastPartsStockExcelInput {
  overviewItems: Array<Record<string, any>>;
  ledgerSections: Array<{ sku: string; partName: string; rows: any[] }>;
  selectedColumns?: string[];
}

const QTY_FMT = '#,##0';
const MONEY_FMT = '#,##0.00';
const DATE_FMT = 'dd/mm/yyyy';

const HEADER_ROW = 4;
const DATA_START_ROW = 5;

const BORDER_THIN = {
  top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

const SOLID = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb },
});

export const VINFAST_STOCK_SUMMARY_COLUMNS: StockColumnDef[] = [
  { key: 'stt', header: 'STT', width: 8, align: 'center' },
  { key: 'sku', header: 'Mã Phụ Tùng', width: 22, align: 'left' },
  { key: 'name', header: 'Tên Phụ Tùng', width: 35, align: 'left' },
  { key: 'uom', header: 'ĐVT', width: 12, align: 'center' },
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
    header: 'Tồn Kho',
    width: 16,
    align: 'right',
    numFmt: QTY_FMT,
    sum: true,
  },
];

export const VINFAST_STOCK_LEDGER_COLUMNS: StockColumnDef[] = [
  { key: 'partSku', header: 'Mã Phụ Tùng', width: 22, align: 'left' },
  { key: 'partName', header: 'Tên Phụ Tùng', width: 30, align: 'left' },
  {
    key: 'transactionDate',
    header: 'Ngày Giao Dịch',
    width: 15,
    align: 'center',
    numFmt: DATE_FMT,
  },
  { key: 'invoiceNo', header: 'Số Hóa Đơn', width: 15, align: 'center' },
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
];

const ALLOWED_COLUMN_KEYS = new Set(
  [...VINFAST_STOCK_SUMMARY_COLUMNS, ...VINFAST_STOCK_LEDGER_COLUMNS].map(
    (c) => c.key,
  ),
);

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
  return all.filter((c) => selected.includes(c.key));
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
    qtyIn: Number(item.qtyIn || 0),
    qtyOut: Number(item.qtyOut || 0),
    qtyBalance: Number(item.qtyBalance || 0),
  }));
}

function ledgerRows(sections: VinfastPartsStockExcelInput['ledgerSections']) {
  return sections.flatMap((section) =>
    section.rows.map((row) => ({
      partSku: section.sku,
      partName: section.partName,
      transactionDate: toVietnamExcelDate(row.transactionDate) ?? '',
      invoiceNo: row.invoiceNo,
      direction: row.direction,
      qty: Number(row.qty || 0),
      unitCost: Number(row.unitCost || 0),
      amount: Number(row.preVatAmount || 0),
      licensePlate: row.licensePlate || '',
      runningBalanceQty: row.runningBalanceQty,
      runningBalanceValue: row.runningBalanceValue,
    })),
  );
}

function writeSheet(
  workbook: Workbook,
  name: string,
  defs: StockColumnDef[],
  rows: Record<string, any>[],
): void {
  const sheet: Worksheet = workbook.addWorksheet(name);
  sheet.columns = defs.map((d) => ({ key: d.key, width: d.width }));

  // Row 1: TỔNG, Row 2: SUBTOTAL theo bộ lọc, Row 3: trống, Row 4: header
  for (let i = 0; i < HEADER_ROW; i++) sheet.addRow([]);

  const dataEnd = DATA_START_ROW + rows.length - 1;
  const totalRow = sheet.getRow(1);
  const subRow = sheet.getRow(2);
  totalRow.height = 20;
  subRow.height = 20;
  totalRow.font = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: 'FF78350F' },
  };
  subRow.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF475569' },
  };

  defs.forEach((d, i) => {
    const col = i + 1;
    const letter = sheet.getColumn(col).letter;
    const totalCell = totalRow.getCell(col);
    const subCell = subRow.getCell(col);

    totalCell.fill = SOLID('FFFFFBEB');
    subCell.fill = SOLID('FFF8FAFC');
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

  const headerRow = sheet.getRow(HEADER_ROW);
  headerRow.height = 24;
  defs.forEach((d, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = d.header;
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = SOLID('FF334155');
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = BORDER_THIN;
  });

  for (const row of rows) {
    const dataRow = sheet.addRow(defs.map((d) => toCellValue(row[d.key])));
    dataRow.height = 20;
    dataRow.font = { name: 'Calibri', size: 10 };
    defs.forEach((d, i) => {
      const cell = dataRow.getCell(i + 1);
      cell.alignment = { horizontal: d.align, vertical: 'middle' };
      cell.border = BORDER_THIN;
      if (d.numFmt) cell.numFmt = d.numFmt;
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

  if (summaryDefs.length > 0) {
    writeSheet(
      workbook,
      'Tổng Hợp Tồn Kho',
      summaryDefs,
      summaryRows(input.overviewItems),
    );
  }
  if (ledgerDefs.length > 0) {
    writeSheet(
      workbook,
      'Sổ Cái Chi Tiết FIFO',
      ledgerDefs,
      ledgerRows(input.ledgerSections),
    );
  }
  if (workbook.worksheets.length === 0) {
    throw new BadRequestException('Chưa chọn cột nào để xuất.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
}
