import * as ExcelJS from 'exceljs';
import {
  BankStatementExcelBuilder,
  NetOffInvoiceItem,
} from './bank-statement-excel.builder';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';

describe('BankStatementExcelBuilder', () => {
  let builder: BankStatementExcelBuilder;

  beforeEach(() => {
    builder = new BankStatementExcelBuilder();
  });

  it('builds a valid Excel workbook with 21 columns and proper 2-tone styles', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-1',
        transDate: new Date('2026-03-14T14:01:32.000Z'), // 21:01:32 in Vietnam
        referenceNumber: 'FT26073820107654',
        description: 'Thanh toan tien sua chua',
        creditAmount: 461052 as any,
        debitAmount: 0 as any,
        balance: 18365223 as any,
        correspondentAccount: '333311188',
        correspondentName: 'TA QUANG NHAT',
        correspondentBank: 'Techcombank',
        bankAccount: {
          bankCode: 'TCB',
          accountNumber: '111886',
        } as any,
        branch: {
          name: 'Chi nhánh Nam Sài Gòn',
        } as any,
      },
    ];

    const netOffDetails: NetOffInvoiceItem[] = [
      {
        bankTransactionId: 'txn-1',
        netOffAmount: 461052,
        invoiceId: 'inv-1',
        invoiceNo: '0001234',
        serialNo: '1C26TBB',
        invoiceDate: '2026-03-12',
        invoiceDescription: 'Dich vu son phu gam',
        direction: 'OUT',
        buyerName: 'CONG TY GREENWAY AUTO',
        buyerTaxCode: '0317894561',
        totalAmount: 1500000,
        invoiceBranchName: 'Chi nhánh Nam Sài Gòn',
      },
    ];

    const buffer = await builder.build({
      sourceType: 'BANK',
      transactions: transactions as ErpBankTransaction[],
      netOffDetails,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    // Read back with ExcelJS to verify structure and formatting
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    expect(worksheet).toBeDefined();
    expect(worksheet.name).toBe('Sao kê Ngân hàng');

    // Header row is row 4
    const headerRow = worksheet.getRow(4);
    expect(headerRow.getCell(3).value).toBe('Ngày GD');
    expect(headerRow.getCell(15).value).toBe('[HĐ] Chi nhánh');
    expect(headerRow.getCell(16).value).toBe('[HĐ] Ngày HĐ');
    expect(headerRow.getCell(17).value).toBe('[HĐ] Số HĐ');
    expect(headerRow.getCell(21).value).toBe('[HĐ] Tổng tiền HĐ (VND)');

    // Check Header color separation:
    // Bank cols (1-14) Slate 700: FF334155
    const bankHeaderFill: any = headerRow.getCell(3).fill;
    expect(bankHeaderFill?.fgColor?.argb).toBe('FF334155');

    // Invoice cols (15-21) Emerald 800: FF065F46
    const invHeaderFill: any = headerRow.getCell(15).fill;
    expect(invHeaderFill?.fgColor?.argb).toBe('FF065F46');

    // Data row is row 5
    const dataRow = worksheet.getRow(5);

    // Verify Column 3 (Ngày GD): Value MUST be a Date instance for Pivot Table grouping
    const dateCell = dataRow.getCell(3);
    expect(dateCell.value).toBeInstanceOf(Date);
    const dateVal = dateCell.value as Date;
    expect(dateVal.getUTCFullYear()).toBe(2026);
    expect(dateVal.getUTCMonth()).toBe(2); // March
    expect(dateVal.getUTCDate()).toBe(14);
    expect(dateVal.getUTCHours()).toBe(21); // Correct GMT+7 hour!
    expect(dateVal.getUTCMinutes()).toBe(1);
    expect(dateVal.getUTCSeconds()).toBe(32);
    expect(dateCell.numFmt).toBe('dd/mm/yyyy hh:mm:ss');

    // Verify Column 15-21 (Invoice Net-off fields)
    expect(dataRow.getCell(15).value).toBe('Chi nhánh Nam Sài Gòn');
    expect(dataRow.getCell(16).value).toBe('12/03/2026');
    expect(dataRow.getCell(17).value).toBe('0001234');
    expect(dataRow.getCell(18).value).toBe('1C26TBB');
    expect(dataRow.getCell(19).value).toContain('CONG TY GREENWAY AUTO');
    expect(dataRow.getCell(20).value).toBe('Dich vu son phu gam');
    expect(dataRow.getCell(21).value).toBe(1500000);
    expect(dataRow.getCell(21).numFmt).toBe('#,##0.00');

    // Verify 2-tone fill style for data cells:
    // Invoice cell (col 15) must have pastel fill FFF0FDF4 and double left border
    const invDataFill: any = dataRow.getCell(15).fill;
    expect(invDataFill?.fgColor?.argb).toBe('FFF0FDF4');
    expect(dataRow.getCell(15).border?.left?.style).toBe('double');

    // Verify SUM formula in row 1
    const sumRow = worksheet.getRow(1);
    expect(sumRow.getCell(6).value).toMatchObject({
      formula: expect.stringContaining('SUM'),
    });
  });

  it('gracefully handles transactions without invoice net-offs and cash books', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-2',
        transDate: null as any,
        creditAmount: 0 as any,
        debitAmount: 100000 as any,
        cashBook: { name: 'Quỹ tiền mặt VP' } as any,
      },
    ];

    const buffer = await builder.build({
      sourceType: 'CASH',
      transactions: transactions as ErpBankTransaction[],
      netOffDetails: [],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    expect(worksheet.name).toBe('Sổ quỹ Tiền mặt');

    const dataRow = worksheet.getRow(5);
    expect(dataRow.getCell(2).value).toBe('Quỹ tiền mặt VP');
    expect(dataRow.getCell(3).value).toBe('');
    expect(dataRow.getCell(15).value).toBe('');
    expect(dataRow.getCell(17).value).toBe('');
  });
});
