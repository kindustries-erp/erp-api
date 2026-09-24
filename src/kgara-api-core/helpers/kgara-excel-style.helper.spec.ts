import * as ExcelJS from 'exceljs';
import {
  getExcelColumnLetter,
  applyStandardExcelReportLayout,
  ExcelReportColumnDef,
} from './kgara-excel-style.helper';

describe('kgara-excel-style.helper', () => {
  describe('getExcelColumnLetter', () => {
    it('should correctly convert 1-based index to Excel column letters', () => {
      expect(getExcelColumnLetter(1)).toBe('A');
      expect(getExcelColumnLetter(10)).toBe('J');
      expect(getExcelColumnLetter(26)).toBe('Z');
      expect(getExcelColumnLetter(27)).toBe('AA');
      expect(getExcelColumnLetter(28)).toBe('AB');
    });
  });

  describe('applyStandardExcelReportLayout', () => {
    it('should generate Rows 1-4 with SUM, SUBTOTAL, Blank, Header and AutoFilter', () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test Sheet');

      const columns: ExcelReportColumnDef[] = [
        { header: 'STT', key: 'index', width: 8, align: 'center' },
        { header: 'Số phiếu', key: 'soChungTu', width: 18, align: 'left' },
        { header: 'Tên KH', key: 'khachHangName', width: 30, align: 'left' },
        {
          header: 'Tổng tiền',
          key: 'totalAmount',
          width: 20,
          isSum: true,
          style: { numFmt: '#,##0' },
        },
      ];

      // Add dummy data row at row 5
      sheet.addRow({
        index: 1,
        soChungTu: 'PDV-001',
        khachHangName: 'Alpha',
        totalAmount: 1000000,
      });

      applyStandardExcelReportLayout(sheet, columns, 3, {
        totalAmount: 1000000,
      });

      // Row 1: SUM
      const row1 = sheet.getRow(1);
      expect(row1.getCell(3).value).toBe('TỔNG CỘNG (SUM)');
      expect(row1.getCell(4).value).toEqual({
        formula: 'SUM(D5:D5)',
        result: 1000000,
      });

      // Row 2: SUBTOTAL
      const row2 = sheet.getRow(2);
      expect(row2.getCell(3).value).toBe('TỔNG THEO BỘ LỌC (SUBTOTAL)');
      expect(row2.getCell(4).value).toEqual({
        formula: 'SUBTOTAL(9,D5:D5)',
        result: 1000000,
      });

      // Row 3: Blank
      const row3 = sheet.getRow(3);
      expect(row3.height).toBe(10);

      // Row 4: Header
      const row4 = sheet.getRow(4);
      expect(row4.getCell(1).value).toBe('STT');
      expect(row4.getCell(2).value).toBe('Số phiếu');
      expect(row4.getCell(3).value).toBe('Tên KH');
      expect(row4.getCell(4).value).toBe('Tổng tiền');

      // Views and AutoFilter
      expect(sheet.views).toEqual([{ state: 'frozen', ySplit: 4 }]);
      expect(sheet.autoFilter).toEqual({
        from: { row: 4, column: 1 },
        to: { row: 5, column: 4 },
      });
    });
  });
});
