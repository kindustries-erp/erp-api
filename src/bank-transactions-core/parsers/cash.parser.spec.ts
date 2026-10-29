import * as ExcelJS from 'exceljs';
import { parseCashXlsx } from './cash.parser';

const CASH_BOOK_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = '22222222-2222-4222-8222-222222222222';

async function buildCashFile(
  headers: string[],
  rows: Array<Array<string | number>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cash');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('parseCashXlsx — chiều Thu/Chi của sổ quỹ', () => {
  it('cột "Thu" ghi vào creditAmount (thu = credit), cột "Chi" vào debitAmount', async () => {
    const buffer = await buildCashFile(
      ['STT', 'Ngày GD', 'Thu', 'Chi', 'Diễn giải'],
      [
        [1, '2026-10-27 00:00:00', 500000, 0, 'Khách trả tiền'],
        [2, '2026-10-28 00:00:00', 0, 200000, 'Chi phí vận chuyển'],
      ],
    );

    const [receipt, payment] = await parseCashXlsx(
      buffer,
      BRANCH_ID,
      undefined,
      CASH_BOOK_ID,
    );

    expect(receipt).toMatchObject({
      sourceType: 'CASH',
      creditAmount: 500000,
      debitAmount: 0,
    });
    expect(payment).toMatchObject({
      sourceType: 'CASH',
      creditAmount: 0,
      debitAmount: 200000,
    });
  });

  it('header "Phát sinh Nợ" (thu tiền) ghi vào creditAmount, "Phát sinh Có" (chi) vào debitAmount', async () => {
    const buffer = await buildCashFile(
      ['STT', 'Ngày GD', 'Phát sinh Nợ', 'Phát sinh Có'],
      [
        [1, '2026-10-27 00:00:00', 108000, 0],
        [2, '2026-10-28 00:00:00', 0, 54000],
      ],
    );

    const [receipt, payment] = await parseCashXlsx(
      buffer,
      BRANCH_ID,
      undefined,
      CASH_BOOK_ID,
    );

    expect(receipt).toMatchObject({ creditAmount: 108000, debitAmount: 0 });
    expect(payment).toMatchObject({ creditAmount: 0, debitAmount: 54000 });
  });
});
