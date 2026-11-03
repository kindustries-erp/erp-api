import * as ExcelJS from 'exceljs';

export interface CashReceipt {
  /** Số dòng gốc trong sheet (để truy vết). */
  row: number;
  /** Ngày thu dạng YYYY-MM-DD. */
  date: string;
  /** Biển số đã chuẩn hóa (chữ hoa, không khoảng trắng, bỏ "(CỌC)"). */
  plate: string;
  /** Số tiền thu (VND, nguyên). */
  amount: number;
}

export interface CashSheetReadResult {
  receipts: CashReceipt[];
  skipped: Array<{ row: number; reason: string }>;
}

const PLATE_PATTERN = /^\d{2}[A-Z]\d?\d{4,5}$/;
const CASH_TAG_PATTERN = /\(\s*CỌC\s*\)/g;

/** Chuẩn hóa biển số; trả '' nếu không phải biển hợp lệ. */
export function normalizeCashPlate(raw: string): string {
  const plate = raw
    .toUpperCase()
    .replace(CASH_TAG_PATTERN, '')
    .replace(/\s+/g, '');
  return PLATE_PATTERN.test(plate) ? plate : '';
}

const toIsoDate = (value: Date): string => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Đọc sheet sổ thu tiền mặt: cột B = ngày, C = biển số, D = tiền thu.
 * Bỏ dòng không có biển hợp lệ (ví dụ "Số dư đầu kỳ") hoặc không có tiền thu > 0.
 */
export async function readCashReceipts(
  filePath: string,
  sheetName: string,
): Promise<CashSheetReadResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`Không tìm thấy sheet "${sheetName}" trong ${filePath}`);
  }

  const receipts: CashReceipt[] = [];
  const skipped: CashSheetReadResult['skipped'] = [];

  sheet.eachRow((row, rowNumber) => {
    const dateCell = row.getCell(2).value;
    const plateCell = row.getCell(3).value;
    const amountCell = row.getCell(4).value;
    if (!(dateCell instanceof Date)) return;

    const plate = normalizeCashPlate(
      typeof plateCell === 'string' ? plateCell : '',
    );
    if (!plate) {
      skipped.push({ row: rowNumber, reason: 'KHONG_PHAI_BIEN_SO' });
      return;
    }
    const amount = typeof amountCell === 'number' ? amountCell : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped.push({ row: rowNumber, reason: 'KHONG_CO_TIEN_THU' });
      return;
    }
    receipts.push({
      row: rowNumber,
      date: toIsoDate(dateCell),
      plate,
      amount,
    });
  });

  return { receipts, skipped };
}
