import * as ExcelJS from 'exceljs';
import { CreateBankTransactionDto } from '../dto/create-bank-transaction.dto';

export async function parseCashXlsx(
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

  // Find column mapping dynamically based on header
  let colMap: Record<string, number> = {};

  worksheet.eachRow((row, rowNumber) => {
    if (!startParsing) {
      const rowValues = row.values as any[];
      // Check if this is the header row by looking for key columns
      const hasStt = rowValues.some((v) =>
        String(v).toLowerCase().includes('stt'),
      );
      const hasDate = rowValues.some(
        (v) =>
          String(v).toLowerCase().includes('ngày gd') ||
          String(v).toLowerCase().includes('ngày giao dịch'),
      );

      if (hasStt && hasDate) {
        startParsing = true;
        // Build column map
        rowValues.forEach((val, idx) => {
          if (!val) return;
          const header = String(val).toLowerCase().trim();
          if (header.includes('stt')) colMap['stt'] = idx;
          else if (
            header.includes('ngày gd') ||
            header.includes('ngày giao dịch')
          )
            colMap['transDate'] = idx;
          else if (header.includes('ngày hl') || header.includes('hiệu lực'))
            colMap['efdDate'] = idx;
          else if (
            header.includes('phát sinh nợ') ||
            header.includes('thu') ||
            header.includes('ghi nợ')
          )
            colMap['debit'] = idx;
          else if (
            header.includes('phát sinh có') ||
            header.includes('chi') ||
            header.includes('ghi có')
          )
            colMap['credit'] = idx;
          else if (header.includes('số dư')) colMap['balance'] = idx;
          else if (
            header.includes('số ct') ||
            header.includes('chứng từ') ||
            header.includes('mã gd')
          )
            colMap['seqNo'] = idx;
          else if (header.includes('diễn giải')) colMap['description'] = idx;
          else if (header.includes('tk đối ứng')) colMap['corrAccount'] = idx;
          else if (
            header.includes('tên đối ứng') ||
            header.includes('người nộp') ||
            header.includes('người nhận')
          )
            colMap['corrName'] = idx;
          else if (
            header.includes('nh đối ứng') ||
            header.includes('ngân hàng đối ứng')
          )
            colMap['corrBank'] = idx;
          else if (header.includes('số tham chiếu')) colMap['refNum'] = idx;
        });
      }
      return;
    }

    // Parse data row
    const getVal = (colKey: string) => {
      const idx = colMap[colKey];
      if (!idx) return null;
      const cell = row.getCell(idx);
      return cell ? cell.value : null;
    };

    const parseString = (colKey: string) => {
      const val = getVal(colKey);
      if (val === null || val === undefined) return null;
      if (typeof val === 'object' && 'richText' in val) {
        return (val as any).richText
          .map((t: any) => t.text)
          .join('')
          .trim();
      }
      return String((val as any)?.toString?.() || '').trim();
    };

    const parseNumber = (colKey: string) => {
      const val = getVal(colKey);
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const num = Number(val.replace(/,/g, '').replace(/ /g, ''));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    const parseDate = (colKey: string): Date | null => {
      const val = getVal(colKey);
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        // Try parsing DD/MM/YYYY
        const parts = val.split(/[/\- ]/);
        if (parts.length >= 3) {
          // Assuming DD/MM/YYYY
          const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          if (!isNaN(d.getTime())) return d;
        }
        const d2 = new Date(val);
        if (!isNaN(d2.getTime())) return d2;
      }
      return null;
    };

    const stt = parseNumber('stt');
    if (!stt) return; // End of data or empty row

    const transDate = parseDate('transDate');
    if (!transDate) return;

    transactions.push({
      sourceType: bankAccountId ? 'BANK' : 'CASH',
      branchId,
      bankAccountId,
      cashBookId,
      stt,
      transDate: transDate.toISOString(),
      efdDate: parseDate('efdDate')?.toISOString(),
      referenceNumber: parseString('refNum') || undefined,
      debitAmount: parseNumber('debit'),
      creditAmount: parseNumber('credit'),
      balance: parseNumber('balance') || undefined,
      seqNo: parseString('seqNo') || undefined,
      description: parseString('description') || undefined,
      correspondentAccount: parseString('corrAccount') || undefined,
      correspondentName: parseString('corrName') || undefined,
      correspondentBank: parseString('corrBank') || undefined,
    });
  });

  return transactions;
}
