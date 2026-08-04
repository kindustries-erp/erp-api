import { parse } from 'csv-parse/sync';
import { CreateBankTransactionDto } from '../dto/create-bank-transaction.dto';
import * as ExcelJS from 'exceljs';
import { parseVNLocalDate } from './date-parser';

export function parseTcbCsv(
  buffer: Buffer,
  branchId: string,
  bankAccountId?: string,
  cashBookId?: string,
  expectedAccountNumber?: string,
): CreateBankTransactionDto[] {
  // Convert buffer to string, TCB CSV might have different encodings, assuming utf-8 for now
  const fileContent = buffer.toString('utf-8');

  // Parse CSV
  const records = parse(fileContent, {
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const transactions: CreateBankTransactionDto[] = [];
  let startParsing = false;
  let stopParsing = false;

  for (const record of records) {
    if (stopParsing) break;
    if (!startParsing) {
      // Check for header row
      if (
        record.length >= 10 &&
        String(record[0]).includes('Ngay KH thuc hien')
      ) {
        startParsing = true;
      }
      continue;
    }

    // Now parsing data rows
    // Column indices based on TCB format:
    // 0: Ngay KH thuc hien
    // 1: Ngay giao dich
    // 2: So but toan
    // 3: Ngan hang doi tac
    // 4: Tai khoan dich
    // 5: Ten tai khoan doi ung
    // 6: Dien giai
    // 7: No/Debit
    // 8: Co/Credit
    // 9: Phi - Lai
    // 10: Thue/VAT
    // 11: So du

    if (record.length < 9) continue; // Skip malformed rows

    const efdDateRaw = record[0]?.trim();
    const transDateRaw = record[1]?.trim();
    const referenceNumber = record[2]?.trim() || undefined;

    const refStr = (referenceNumber || '').toLowerCase();
    if (
      !referenceNumber ||
      refStr.includes('ngày giờ in') ||
      refStr.includes('phiếu này được in')
    ) {
      stopParsing = true;
      break;
    }

    const correspondentBank = record[3]?.trim() || undefined;
    const correspondentAccount = record[4]?.trim() || undefined;
    const correspondentName = record[5]?.trim() || undefined;
    const description = record[6]?.trim() || undefined;

    // Remove commas, spaces, or negative signs (often debits are negative in CSV, sometimes not)
    const parseAmount = (val: string) => {
      if (!val) return 0;
      const num = Number(val.replace(/,/g, '').replace(/ /g, ''));
      return isNaN(num) ? 0 : Math.abs(num); // Ensure positive absolute value
    };

    let debitAmount = parseAmount(record[7]);
    const creditAmount = parseAmount(record[8]);
    const fee = parseAmount(record[9]);
    const tax = parseAmount(record[10]);
    const balance = parseAmount(record[11]);

    // If there is fee and it's a debit transaction, add fee to debit
    if (fee > 0 || tax > 0) {
      if (debitAmount > 0) {
        debitAmount += fee + tax;
      } else if (creditAmount === 0 && debitAmount === 0) {
        debitAmount = fee + tax;
      }
    }

    if (!transDateRaw) continue;

    let transDate = parseVNLocalDate(transDateRaw);
    let efdDate = parseVNLocalDate(efdDateRaw);

    transactions.push({
      sourceType: bankAccountId ? 'BANK' : 'CASH',
      branchId,
      bankAccountId,
      cashBookId,
      transDate: efdDate
        ? efdDate.toISOString()
        : transDate
          ? transDate.toISOString()
          : new Date().toISOString(),
      efdDate: transDate ? transDate.toISOString() : undefined,
      referenceNumber,
      debitAmount,
      creditAmount,
      balance: isNaN(balance) ? undefined : balance,
      description,
      correspondentAccount,
      correspondentName,
      correspondentBank,
    });
  }

  if (!startParsing) {
    throw new Error('File không đúng định dạng sao kê TCB');
  }

  return transactions;
}

export async function parseTcbXlsx(
  buffer: Buffer | any,
  branchId: string,
  bankAccountId?: string,
  cashBookId?: string,
  expectedAccountNumber?: string,
): Promise<CreateBankTransactionDto[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File excel không có dữ liệu');
  }

  // Validate TCB specific cells
  const a1 = String((worksheet.getCell('A1').value as any) || '').toLowerCase();
  if (
    !a1.includes('kỹ thương') &&
    !a1.includes('techcombank') &&
    !a1.includes('tcb')
  ) {
    throw new Error(
      'File không đúng định dạng sao kê TCB (Thông tin ngân hàng ở ô A1 không khớp)',
    );
  }

  if (expectedAccountNumber) {
    const b9 = String((worksheet.getCell('B9').value as any) || '').trim();
    if (b9 !== expectedAccountNumber) {
      throw new Error(
        `File sao kê không khớp với số tài khoản đích ${expectedAccountNumber} (Số tài khoản trong file: ${b9})`,
      );
    }
  }

  const transactions: CreateBankTransactionDto[] = [];
  let startParsing = false;
  let stopParsing = false;

  worksheet.eachRow((row, rowNumber) => {
    if (stopParsing) return;
    if (!startParsing) {
      const rowValues = row.values as any[];
      const hasTcbHeader = rowValues.some(
        (v) =>
          String(v).toLowerCase().includes('ngày kh thực hiện') ||
          String(v).toLowerCase().includes('số bút toán'),
      );
      if (hasTcbHeader) {
        startParsing = true;
      }
      return;
    }

    const rowValues = row.values as any[];
    // row.values is 1-indexed in exceljs
    const efdDateRaw = rowValues[1];
    const transDateRaw = rowValues[2];
    const referenceNumber = rowValues[3]?.toString().trim() || undefined;

    const refStr = (referenceNumber || '').toLowerCase();
    if (
      !referenceNumber ||
      refStr.includes('ngày giờ in') ||
      refStr.includes('phiếu này được in')
    ) {
      stopParsing = true;
      return;
    }

    const correspondentBank = rowValues[4]?.toString().trim() || undefined;
    const correspondentAccount = rowValues[5]?.toString().trim() || undefined;
    const correspondentName = rowValues[6]?.toString().trim() || undefined;
    const description = rowValues[7]?.toString().trim() || undefined;

    const parseAmount = (val: any) => {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'number') return Math.abs(val);
      const num = Number(String(val).replace(/,/g, '').replace(/ /g, ''));
      return isNaN(num) ? 0 : Math.abs(num);
    };

    let debitAmount = parseAmount(rowValues[8]);
    const creditAmount = parseAmount(rowValues[9]);
    const fee = parseAmount(rowValues[10]);
    const tax = parseAmount(rowValues[11]);
    const balance = parseAmount(rowValues[12]);

    if (fee > 0 || tax > 0) {
      if (debitAmount > 0) {
        debitAmount += fee + tax;
      } else if (creditAmount === 0 && debitAmount === 0) {
        debitAmount = fee + tax;
      }
    }

    if (!transDateRaw) return;
    if (String(transDateRaw).includes('TỔNG PHÁT SINH')) return;

    let transDate = parseVNLocalDate(transDateRaw);
    let efdDate = parseVNLocalDate(efdDateRaw);

    transactions.push({
      sourceType: bankAccountId ? 'BANK' : 'CASH',
      branchId,
      bankAccountId,
      cashBookId,
      transDate: efdDate
        ? efdDate.toISOString()
        : transDate
          ? transDate.toISOString()
          : new Date().toISOString(),
      efdDate: transDate ? transDate.toISOString() : undefined,
      referenceNumber,
      debitAmount,
      creditAmount,
      balance: balance === 0 && !rowValues[12] ? undefined : balance,
      description,
      correspondentAccount,
      correspondentName,
      correspondentBank,
    });
  });

  if (!startParsing) {
    throw new Error('File không đúng định dạng sao kê TCB');
  }

  return transactions;
}
