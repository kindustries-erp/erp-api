import { parse } from 'csv-parse/sync';
import { CreateBankTransactionDto } from '../dto/create-bank-transaction.dto';
import * as ExcelJS from 'exceljs';

export function parseTcbCsv(
  buffer: Buffer,
  branchId: string,
  bankAccountId?: string,
  cashBookId?: string,
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

  for (const record of records) {
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
    const balance = parseAmount(record[11]);

    // If there is fee and it's a debit transaction, add fee to debit
    if (fee > 0) {
      if (debitAmount > 0) {
        debitAmount += fee;
      } else if (creditAmount === 0 && debitAmount === 0) {
        // If it's just a fee transaction
        debitAmount = fee;
      }
    }

    if (!transDateRaw) continue;

    // Convert DD/MM/YYYY or YYYY-MM-DD to proper ISO date string if necessary.
    // In the sample, it is "YYYY-MM-DD HH:mm:ss" and "YYYY-MM-DD".
    // new Date(transDateRaw) should work for "2026-05-30" or "2026-05-30 16:44:52"
    let transDate = new Date(transDateRaw);
    if (isNaN(transDate.getTime())) {
      // Try to parse DD/MM/YYYY
      const parts = transDateRaw.split('/');
      if (parts.length === 3) {
        transDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }

    let efdDate: Date | undefined;
    if (efdDateRaw) {
      efdDate = new Date(efdDateRaw);
      if (isNaN(efdDate.getTime())) {
        const parts = efdDateRaw.split('/');
        if (parts.length === 3) {
          efdDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
    }

    transactions.push({
      sourceType: bankAccountId ? 'BANK' : 'CASH',
      branchId,
      bankAccountId,
      cashBookId,
      transDate: transDate.toISOString(),
      efdDate:
        efdDate && !isNaN(efdDate.getTime())
          ? efdDate.toISOString()
          : undefined,
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

  return transactions;
}

export async function parseTcbXlsx(
  buffer: Buffer | any,
  branchId: string,
  bankAccountId?: string,
  cashBookId?: string,
): Promise<CreateBankTransactionDto[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File excel không có dữ liệu');
  }

  const transactions: CreateBankTransactionDto[] = [];
  let startParsing = false;

  worksheet.eachRow((row, rowNumber) => {
    if (!startParsing) {
      const rowValues = row.values as any[];
      const hasDate = rowValues.some(
        (v) =>
          String(v).toLowerCase().includes('ngày kh thực hiện') ||
          String(v).toLowerCase().includes('ngày giao dịch'),
      );
      if (hasDate) {
        startParsing = true;
      }
      return;
    }

    const rowValues = row.values as any[];
    // row.values is 1-indexed in exceljs
    const efdDateRaw = rowValues[1];
    const transDateRaw = rowValues[2];
    const referenceNumber = rowValues[3]?.toString().trim() || undefined;
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
    const balance = parseAmount(rowValues[12]);

    if (fee > 0) {
      if (debitAmount > 0) {
        debitAmount += fee;
      } else if (creditAmount === 0 && debitAmount === 0) {
        debitAmount = fee;
      }
    }

    if (!transDateRaw) return;
    if (String(transDateRaw).includes('TỔNG PHÁT SINH')) return;

    let transDate = new Date(transDateRaw);
    if (isNaN(transDate.getTime())) {
      const parts = String(transDateRaw).trim().split('/');
      if (parts.length === 3) {
        transDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        const partsSpace = String(transDateRaw).trim().split(' ')[0].split('/');
        if (partsSpace.length === 3) {
          transDate = new Date(
            `${partsSpace[2]}-${partsSpace[1]}-${partsSpace[0]}`,
          );
        }
      }
    }
    if (isNaN(transDate.getTime())) return;

    let efdDate: Date | undefined;
    if (efdDateRaw) {
      efdDate = new Date(efdDateRaw);
      if (isNaN(efdDate.getTime())) {
        const parts = String(efdDateRaw).trim().split('/');
        if (parts.length === 3) {
          efdDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
    }

    transactions.push({
      sourceType: bankAccountId ? 'BANK' : 'CASH',
      branchId,
      bankAccountId,
      cashBookId,
      transDate: transDate.toISOString(),
      efdDate:
        efdDate && !isNaN(efdDate.getTime())
          ? efdDate.toISOString()
          : undefined,
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

  return transactions;
}
