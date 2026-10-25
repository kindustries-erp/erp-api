import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  buildVinfastPartsStockWorkbook,
  parseSelectedColumns,
} from './vinfast-parts-stock-excel.builder';

const overviewItems = [
  {
    sku: 'P-001',
    name: 'Lọc gió',
    uom: 'Cái',
    qtyIn: 10,
    qtyOut: 4,
    qtyBalance: 6,
  },
  {
    sku: 'P-002',
    name: 'Má phanh',
    uom: 'Bộ',
    qtyIn: 5,
    qtyOut: 1,
    qtyBalance: 4,
  },
];

const ledgerSections = [
  {
    sku: 'P-001',
    partName: 'Lọc gió',
    rows: [
      {
        transactionDate: '2026-03-01T00:00:00.000Z',
        invoiceNo: 'HD001',
        direction: 'IN',
        qty: 10,
        unitCost: 100000,
        preVatAmount: 1000000,
        licensePlate: '29A-12345',
        runningBalanceQty: 10,
        runningBalanceValue: 1000000,
      },
      {
        transactionDate: '2026-03-02T00:00:00.000Z',
        invoiceNo: 'HD002',
        direction: 'OUT',
        qty: 4,
        unitCost: 100000,
        preVatAmount: 400000,
        licensePlate: '',
        runningBalanceQty: 6,
        runningBalanceValue: 600000,
      },
    ],
  },
];

async function load(buffer: Buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe('buildVinfastPartsStockWorkbook', () => {
  it('writes two sheets with header on row 4 and data from row 5', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({ overviewItems, ledgerSections }),
    );

    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng Hợp Tồn Kho',
      'Sổ Cái Chi Tiết FIFO',
    ]);

    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;
    expect(summary.getRow(4).getCell(2).value).toBe('Mã Phụ Tùng');
    expect(summary.getRow(5).getCell(2).value).toBe('P-001');
    expect(summary.getRow(6).getCell(7).value).toBe(4);
  });

  it('styles header with Slate 700 fill and freezes rows 1-4', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({ overviewItems, ledgerSections }),
    );
    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;

    const headerFill = summary.getRow(4).getCell(1).fill as {
      fgColor?: { argb?: string };
    };
    expect(headerFill.fgColor?.argb).toBe('FF334155');
    expect(summary.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    expect(summary.autoFilter).toBe('A4:G6');
  });

  it('puts SUM and SUBTOTAL formulas on rows 1-2 for numeric columns', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({ overviewItems, ledgerSections }),
    );
    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;

    const total = summary.getRow(1).getCell(5).value as {
      formula: string;
      result: number;
    };
    const sub = summary.getRow(2).getCell(5).value as { formula: string };
    expect(total.formula).toBe('SUM(E5:E6)');
    expect(total.result).toBe(15);
    expect(sub.formula).toBe('SUBTOTAL(9,E5:E6)');
  });

  it('keeps only the selected columns across sheets', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({
        overviewItems,
        ledgerSections,
        selectedColumns: ['sku', 'qtyBalance', 'invoiceNo'],
      }),
    );

    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;
    expect(summary.columnCount).toBe(2);
    expect(summary.getRow(4).getCell(1).value).toBe('Mã Phụ Tùng');
    expect(summary.getRow(4).getCell(2).value).toBe('Tồn Kho');

    const ledger = wb.getWorksheet('Sổ Cái Chi Tiết FIFO')!;
    expect(ledger.columnCount).toBe(1);
    expect(ledger.getRow(4).getCell(1).value).toBe('Số Hóa Đơn');
  });

  it('omits a sheet whose columns are all unselected', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({
        overviewItems,
        ledgerSections,
        selectedColumns: ['sku', 'name'],
      }),
    );
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Tổng Hợp Tồn Kho']);
  });

  it('writes an empty ledger sheet without formulas when there are no rows', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({
        overviewItems: [],
        ledgerSections: [],
      }),
    );
    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;
    expect(summary.getRow(1).getCell(5).value).toBe(0);
    expect(summary.autoFilter).toBeFalsy();
  });
});

describe('parseSelectedColumns', () => {
  it('returns undefined for missing or empty input', () => {
    expect(parseSelectedColumns(undefined)).toBeUndefined();
    expect(parseSelectedColumns([])).toBeUndefined();
  });

  it('accepts whitelisted keys', () => {
    expect(parseSelectedColumns(['sku', 'amount'])).toEqual(['sku', 'amount']);
  });

  it('rejects unknown keys with 400', () => {
    expect(() => parseSelectedColumns(['sku', 'DROP TABLE'])).toThrow(
      BadRequestException,
    );
  });
});
