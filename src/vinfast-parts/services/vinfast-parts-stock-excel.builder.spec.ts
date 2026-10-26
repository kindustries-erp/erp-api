import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  buildVinfastPartsStockWorkbook,
  parseSelectedColumns,
  COLOR,
} from './vinfast-parts-stock-excel.builder';

const overviewItems = [
  {
    sku: 'P-001',
    name: 'Lọc gió',
    uom: 'Cái',
    vehicleType: 'Ô tô',
    qtyOpening: 2,
    qtyIn: 10,
    qtyOut: 4,
    qtyBalance: 8,
  },
  {
    sku: 'P-002',
    name: 'Má phanh',
    uom: 'Bộ',
    vehicleType: 'Xe máy',
    qtyOpening: 0,
    qtyIn: 5,
    qtyOut: 1,
    qtyBalance: 4,
  },
];

const ledgerSections = [
  {
    sku: 'P-001',
    partName: 'Lọc gió',
    vehicleType: 'Ô tô',
    rows: [
      {
        transactionDate: '2026-03-01T00:00:00.000Z',
        direction: 'Nhập',
        qty: 10,
        unitCost: 100000,
        preVatAmount: 1000000,
        licensePlate: '29A-12345',
        runningBalanceQty: 10,
        runningBalanceValue: 1000000,
        invoiceBranchName: 'Chi nhánh HCM',
        invoiceDate: '2026-03-01',
        invoiceNo: 'HD001',
        invoiceSerial: '1C24TML',
        invoiceTaxCode: '0123456789',
        invoicePartner: 'Công ty Phụ Tùng VinFast',
        invoiceItemName: 'Lọc gió điều hòa VF8',
        invoiceItemQty: 10,
        invoiceItemUnitPrice: 100000,
        invoiceItemVatRate: '10%',
        invoiceItemTotalAmount: 1100000,
      },
      {
        transactionDate: '2026-03-02T00:00:00.000Z',
        direction: 'Xuất',
        qty: 4,
        unitCost: 100000,
        preVatAmount: 400000,
        licensePlate: '',
        runningBalanceQty: 6,
        runningBalanceValue: 600000,
        invoiceBranchName: 'Chi nhánh HCM',
        invoiceDate: '2026-03-02',
        invoiceNo: 'HD002',
        invoiceSerial: '1C24TML',
        invoiceTaxCode: '0987654321',
        invoicePartner: 'Nguyễn Văn A',
        invoiceItemName: 'Lọc gió điều hòa VF8',
        invoiceItemQty: 4,
        invoiceItemUnitPrice: 100000,
        invoiceItemVatRate: '10%',
        invoiceItemTotalAmount: 440000,
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
  it('writes two sheets with banner on rows 1-2, totals on 3-4, header on row 6 and data from row 7', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({
        overviewItems,
        ledgerSections,
        periodInfo: {
          dateFrom: '2026-03-01',
          dateTo: '2026-03-31',
          vehicleType: 'CAR',
        },
      }),
    );

    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng Hợp Tồn Kho',
      'Sổ Cái Chi Tiết FIFO',
    ]);

    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;
    expect(summary.getRow(1).getCell(1).value).toBe('TỔNG HỢP TỒN KHO');
    expect(summary.getRow(2).getCell(1).value).toContain(
      'Kỳ báo cáo: Từ ngày 01/03/2026 đến ngày 31/03/2026 | Phân loại: Ô tô',
    );
    expect(summary.getRow(6).getCell(2).value).toBe('Mã Phụ Tùng');
    expect(summary.getRow(6).getCell(5).value).toBe('Loại Xe');
    expect(summary.getRow(6).getCell(6).value).toBe('Tồn Đầu Kỳ');
    expect(summary.getRow(6).getCell(7).value).toBe('Tổng Nhập');
    expect(summary.getRow(6).getCell(8).value).toBe('Tổng Xuất');
    expect(summary.getRow(6).getCell(9).value).toBe('Tồn Cuối Kỳ');

    expect(summary.getRow(7).getCell(2).value).toBe('P-001');
    expect(summary.getRow(7).getCell(5).value).toBe('Ô tô');
    expect(summary.getRow(7).getCell(6).value).toBe(2);

    // Kiểm tra công thức SUMIFS và Tồn cuối kỳ liên sheet
    const row7In = summary.getRow(7).getCell(7).value as {
      formula: string;
      result: number;
    };
    expect(row7In.formula).toBe(
      "SUMIFS('Sổ Cái Chi Tiết FIFO'!$F$7:$F$8, 'Sổ Cái Chi Tiết FIFO'!$A$7:$A$8, B7, 'Sổ Cái Chi Tiết FIFO'!$E$7:$E$8, \"Nhập\")",
    );
    expect(row7In.result).toBe(10);

    const row7Out = summary.getRow(7).getCell(8).value as {
      formula: string;
      result: number;
    };
    expect(row7Out.formula).toBe(
      "SUMIFS('Sổ Cái Chi Tiết FIFO'!$F$7:$F$8, 'Sổ Cái Chi Tiết FIFO'!$A$7:$A$8, B7, 'Sổ Cái Chi Tiết FIFO'!$E$7:$E$8, \"Xuất\")",
    );
    expect(row7Out.result).toBe(4);

    const row7Balance = summary.getRow(7).getCell(9).value as {
      formula: string;
      result: number;
    };
    expect(row7Balance.formula).toBe('F7+G7-H7');
    expect(row7Balance.result).toBe(8);

    const row8Balance = summary.getRow(8).getCell(9).value as {
      formula: string;
      result: number;
    };
    expect(row8Balance.formula).toBe('F8+G8-H8');
    expect(row8Balance.result).toBe(4);
  });

  it('styles header with Slate 700 / Emerald fills and freezes rows 1-6', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({ overviewItems, ledgerSections }),
    );
    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;

    const headerFill = summary.getRow(6).getCell(1).fill as {
      fgColor?: { argb?: string };
    };
    expect(headerFill.fgColor?.argb).toBe(COLOR.headerFill);
    expect(summary.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 6 });
    expect(summary.autoFilter).toBe('A6:I8');

    const ledger = wb.getWorksheet('Sổ Cái Chi Tiết FIFO')!;
    const invHeaderFill = ledger.getRow(6).getCell(12).fill as {
      fgColor?: { argb?: string };
    };
    expect(invHeaderFill.fgColor?.argb).toBe(COLOR.invoiceHeader);
  });

  it('puts SUM and SUBTOTAL formulas on rows 3-4 for numeric columns', async () => {
    const wb = await load(
      await buildVinfastPartsStockWorkbook({ overviewItems, ledgerSections }),
    );
    const summary = wb.getWorksheet('Tổng Hợp Tồn Kho')!;

    const total = summary.getRow(3).getCell(7).value as {
      formula: string;
      result: number;
    };
    const sub = summary.getRow(4).getCell(7).value as { formula: string };
    expect(total.formula).toBe('SUM(G7:G8)');
    expect(total.result).toBe(15);
    expect(sub.formula).toBe('SUBTOTAL(9,G7:G8)');
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
    expect(summary.getRow(6).getCell(1).value).toBe('Mã Phụ Tùng');
    expect(summary.getRow(6).getCell(2).value).toBe('Tồn Cuối Kỳ');

    const ledger = wb.getWorksheet('Sổ Cái Chi Tiết FIFO')!;
    expect(ledger.columnCount).toBe(1);
    expect(ledger.getRow(6).getCell(1).value).toBe('[HĐ] Số HĐ');
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
    expect(summary.getRow(3).getCell(6).value).toBe(0);
    expect(summary.autoFilter).toBeFalsy();
  });
});

describe('parseSelectedColumns', () => {
  it('returns undefined for missing or empty input', () => {
    expect(parseSelectedColumns(undefined)).toBeUndefined();
    expect(parseSelectedColumns([])).toBeUndefined();
  });

  it('accepts whitelisted keys including new invoice columns and aliases', () => {
    expect(
      parseSelectedColumns([
        'sku',
        'amount',
        'invoicePartner',
        'qtyClosing',
        'serialNo',
      ]),
    ).toEqual(['sku', 'amount', 'invoicePartner', 'qtyClosing', 'serialNo']);
  });

  it('rejects unknown keys with 400', () => {
    expect(() => parseSelectedColumns(['sku', 'DROP TABLE'])).toThrow(
      BadRequestException,
    );
  });
});
