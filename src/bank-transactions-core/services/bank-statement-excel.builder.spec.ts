import * as ExcelJS from 'exceljs';
import {
  BankStatementExcelBuilder,
  NetOffInvoiceItem,
} from './bank-statement-excel.builder';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';

const AQUA = 'FFDAEEF3';

const readWorkbook = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
};

describe('BankStatementExcelBuilder', () => {
  let builder: BankStatementExcelBuilder;

  beforeEach(() => {
    builder = new BankStatementExcelBuilder();
  });

  it('builds a valid Excel workbook with 24 columns and Vinfast-style TỔNG/SUBTOTAL rows', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-1',
        bankAccountId: 'acc-1',
        transDate: new Date('2026-03-14T14:01:32.000Z'), // 21:01:32 in Vietnam
        referenceNumber: 'FT26073820107654',
        description: 'Thanh toan tien sua chua',
        creditAmount: 461052 as any,
        debitAmount: 0 as any,
        balance: 18365223 as any,
        correspondentAccount: '333311188',
        correspondentName: 'TA QUANG NHAT',
        correspondentBank: 'Techcombank',
        cashflowClassification: 'OPERATING',
        cashflowPurpose: 'CUSTOMER_PAYMENT',
        note: 'Ghi chú test',
        bankAccount: {
          id: 'acc-1',
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

    expect(buffer.length).toBeGreaterThan(0);

    const workbook = await readWorkbook(buffer);
    const worksheet = workbook.worksheets[0];
    expect(worksheet.name).toBe('TCB - 111886');

    // Header row is row 4
    const headerRow = worksheet.getRow(4);
    expect(headerRow.getCell(3).value).toBe('Ngày GD');
    expect(headerRow.getCell(14).value).toBe('Phân loại');
    expect(headerRow.getCell(15).value).toBe('Mục đích');
    expect(headerRow.getCell(16).value).toBe('Ghi chú');
    expect(headerRow.getCell(17).value).toBe('Chi nhánh GD');
    expect(headerRow.getCell(18).value).toBe('[HĐ] Chi nhánh');
    expect(headerRow.getCell(24).value).toBe('[HĐ] Tổng tiền HĐ (VND)');

    // Header fills: bank Slate 700, invoice Emerald 800, aqua for cashflow + branch
    expect((headerRow.getCell(3).fill as any)?.fgColor?.argb).toBe('FF334155');
    expect((headerRow.getCell(18).fill as any)?.fgColor?.argb).toBe('FF065F46');
    expect((headerRow.getCell(14).fill as any)?.fgColor?.argb).toBe(AQUA);

    // Data row is row 5
    const dataRow = worksheet.getRow(5);

    // Ngày GD must remain a Date instance for pivot grouping
    const dateCell = dataRow.getCell(3);
    expect(dateCell.value).toBeInstanceOf(Date);
    const dateVal = dateCell.value as Date;
    expect(dateVal.getUTCFullYear()).toBe(2026);
    expect(dateVal.getUTCMonth()).toBe(2); // March
    expect(dateVal.getUTCDate()).toBe(14);
    expect(dateVal.getUTCHours()).toBe(21); // GMT+7
    expect(dateVal.getUTCMinutes()).toBe(1);
    expect(dateVal.getUTCSeconds()).toBe(32);
    expect(dateCell.numFmt).toBe('dd/mm/yyyy hh:mm:ss');

    // Cashflow labels + note
    expect(dataRow.getCell(14).value).toBe('Hoạt động kinh doanh');
    expect(dataRow.getCell(15).value).toBe('Khách hàng thanh toán');
    expect(dataRow.getCell(16).value).toBe('Ghi chú test');
    expect(dataRow.getCell(17).value).toBe('Chi nhánh Nam Sài Gòn');

    // Invoice net-off fields (18-24)
    expect(dataRow.getCell(18).value).toBe('Chi nhánh Nam Sài Gòn');
    expect(dataRow.getCell(19).value).toBe('12/03/2026');
    expect(dataRow.getCell(20).value).toBe('0001234');
    expect(dataRow.getCell(21).value).toBe('1C26TBB');
    expect(dataRow.getCell(22).value).toContain('CONG TY GREENWAY AUTO');
    expect(dataRow.getCell(23).value).toBe('Dich vu son phu gam');
    expect(dataRow.getCell(24).value).toBe(1500000);
    expect(dataRow.getCell(24).numFmt).toBe('#,##0.00');

    // Invoice data cell: pastel emerald fill + double left border on first invoice col
    expect((dataRow.getCell(18).fill as any)?.fgColor?.argb).toBe('FFF0FDF4');
    expect(dataRow.getCell(18).border?.left?.style).toBe('double');

    // Aqua fill for cashflow + note + branch data cells, not for others
    expect((dataRow.getCell(14).fill as any)?.fgColor?.argb).toBe(AQUA);
    expect((dataRow.getCell(17).fill as any)?.fgColor?.argb).toBe(AQUA);
    expect((dataRow.getCell(13).fill as any)?.fgColor?.argb).not.toBe(AQUA);

    // Row 1 (TỔNG): label in column 1, amber 50 fill, amber 900 bold font
    const totalRow = worksheet.getRow(1);
    expect(totalRow.getCell(1).value).toBe('TỔNG');
    expect(totalRow.getCell(1).font?.bold).toBe(true);
    expect(totalRow.getCell(1).font?.color?.argb).toBe('FF78350F');
    expect((totalRow.getCell(6).fill as any)?.fgColor?.argb).toBe('FFFFFBEB');
    expect(totalRow.getCell(6).value).toMatchObject({
      formula: 'SUM(F5:F5)',
    });
    expect(totalRow.getCell(24).value).toEqual({
      formula: 'SUM(X5:X5)',
      result: 1500000,
    });
    expect(totalRow.getCell(24).numFmt).toBe('#,##0.00');

    // Row 2 (SUBTOTAL): label in column 1, slate 50 fill, slate 600 italic font
    const subtotalRow = worksheet.getRow(2);
    expect(subtotalRow.getCell(1).value).toBe('SUBTOTAL (theo bộ lọc)');
    expect(subtotalRow.getCell(1).font?.italic).toBe(true);
    expect(subtotalRow.getCell(1).font?.color?.argb).toBe('FF475569');
    expect((subtotalRow.getCell(6).fill as any)?.fgColor?.argb).toBe(
      'FFF8FAFC',
    );
    expect(subtotalRow.getCell(24).value).toEqual({
      formula: 'SUBTOTAL(9,X5:X5)',
      result: 1500000,
    });
    expect(subtotalRow.getCell(24).numFmt).toBe('#,##0.00');
  });

  it('gracefully handles transactions without invoice net-offs and cash books', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-2',
        cashBookId: 'cb-1',
        transDate: null as any,
        creditAmount: 0 as any,
        debitAmount: 100000 as any,
        cashBook: { id: 'cb-1', name: 'Quỹ tiền mặt VP' } as any,
      },
    ];

    const buffer = await builder.build({
      sourceType: 'CASH',
      transactions: transactions as ErpBankTransaction[],
      netOffDetails: [],
    });

    const workbook = await readWorkbook(buffer);
    const worksheet = workbook.worksheets[0];
    expect(worksheet.name).toBe('Quỹ tiền mặt VP');

    const dataRow = worksheet.getRow(5);
    expect(dataRow.getCell(2).value).toBe('Quỹ tiền mặt VP');
    expect(dataRow.getCell(3).value).toBe('');
    expect(dataRow.getCell(18).value).toBe('');
    expect(dataRow.getCell(20).value).toBe('');
  });

  it('writes the default sheet name with a TỔNG/SUBTOTAL header when there are no transactions', async () => {
    const buffer = await builder.build({
      sourceType: 'CASH',
      transactions: [],
      netOffDetails: [],
    });

    const workbook = await readWorkbook(buffer);
    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.worksheets[0].name).toBe('Sổ quỹ Tiền mặt');
    expect(workbook.worksheets[0].getRow(1).getCell(1).value).toBe('TỔNG');
    expect(workbook.worksheets[0].getRow(1).getCell(6).value).toBe(0);
  });

  it('filters columns dynamically when selectedColumns is provided', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-3',
        transDate: new Date('2026-03-14T14:01:32.000Z'),
        referenceNumber: 'FT123456',
        description: 'Test Selected Columns',
        creditAmount: 500000 as any,
        debitAmount: 0 as any,
      },
    ];

    const buffer = await builder.build({
      sourceType: 'BANK',
      transactions: transactions as ErpBankTransaction[],
      netOffDetails: [],
      selectedColumns: ['stt', 'transDate', 'credit', 'description'],
    });

    const workbook = await readWorkbook(buffer);
    const worksheet = workbook.worksheets[0];

    // Natural order in allColumns: stt (1), transDate (2), description (3), credit (4)
    const headerRow = worksheet.getRow(4);
    expect(headerRow.getCell(1).value).toBe('STT');
    expect(headerRow.getCell(2).value).toBe('Ngày GD');
    expect(headerRow.getCell(3).value).toBe('Diễn giải');
    expect(headerRow.getCell(4).value).toBe('Thu (VND)');
    expect(headerRow.getCell(5).value).toBeNull();

    const dataRow = worksheet.getRow(5);
    expect(dataRow.getCell(1).value).toBe(1);
    expect(dataRow.getCell(2).value).toBeInstanceOf(Date);
    expect(dataRow.getCell(3).value).toBe('Test Selected Columns');
    expect(dataRow.getCell(4).value).toBe(500000);
    expect(dataRow.getCell(4).numFmt).toBe('#,##0.00');
  });

  it('tách mỗi tài khoản ngân hàng thành một sheet, STT bắt đầu lại từ 1', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-a1',
        bankAccountId: 'acc-a',
        creditAmount: 100 as any,
        debitAmount: 0 as any,
        bankAccount: {
          id: 'acc-a',
          bankCode: 'TCB',
          accountNumber: '111',
        } as any,
      },
      {
        id: 'txn-b1',
        bankAccountId: 'acc-b',
        creditAmount: 200 as any,
        debitAmount: 0 as any,
        bankAccount: {
          id: 'acc-b',
          bankCode: 'VCB',
          accountNumber: '222',
        } as any,
      },
      {
        id: 'txn-a2',
        bankAccountId: 'acc-a',
        creditAmount: 300 as any,
        debitAmount: 0 as any,
        bankAccount: {
          id: 'acc-a',
          bankCode: 'TCB',
          accountNumber: '111',
        } as any,
      },
    ];

    const buffer = await builder.build({
      sourceType: 'BANK',
      transactions: transactions as ErpBankTransaction[],
      netOffDetails: [],
    });

    const workbook = await readWorkbook(buffer);
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
      'TCB - 111',
      'VCB - 222',
    ]);

    const tcb = workbook.getWorksheet('TCB - 111')!;
    expect(tcb.getRow(5).getCell(1).value).toBe(1);
    expect(tcb.getRow(6).getCell(1).value).toBe(2);
    // Tổng riêng của sheet TCB: 100 + 300
    expect(tcb.getRow(1).getCell(6).value).toEqual({
      formula: 'SUM(F5:F6)',
      result: 400,
    });

    const vcb = workbook.getWorksheet('VCB - 222')!;
    expect(vcb.getRow(5).getCell(1).value).toBe(1);
    expect(vcb.getRow(1).getCell(6).value).toEqual({
      formula: 'SUM(F5:F5)',
      result: 200,
    });
  });

  it('gom giao dịch không có tài khoản vào sheet "Khác" và tránh trùng tên sheet', async () => {
    const transactions: Partial<ErpBankTransaction>[] = [
      {
        id: 'txn-x1',
        bankAccountId: 'acc-1',
        creditAmount: 1 as any,
        debitAmount: 0 as any,
        bankAccount: {
          id: 'acc-1',
          bankCode: 'TCB',
          accountNumber: '999',
        } as any,
      },
      {
        id: 'txn-x2',
        bankAccountId: 'acc-2',
        creditAmount: 1 as any,
        debitAmount: 0 as any,
        bankAccount: {
          id: 'acc-2',
          bankCode: 'TCB',
          accountNumber: '999',
        } as any,
      },
      {
        id: 'txn-x3',
        creditAmount: 1 as any,
        debitAmount: 0 as any,
      },
    ];

    const buffer = await builder.build({
      sourceType: 'BANK',
      transactions: transactions as ErpBankTransaction[],
      netOffDetails: [],
    });

    const workbook = await readWorkbook(buffer);
    expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
      'TCB - 999',
      'TCB - 999 (2)',
      'Khác',
    ]);
  });
});
