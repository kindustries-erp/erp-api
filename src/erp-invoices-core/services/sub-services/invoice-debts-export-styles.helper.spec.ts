import { Workbook } from 'exceljs';
import {
  getDebtSummaryColumns,
  getDebtDetailColumns,
  initSheetStructure,
  finalizeSheetLayout,
  formatSummaryDataRow,
  formatDetailDataRow,
  COLOR_HEADER_DEFAULT,
  COLOR_AGING_0_30,
  COLOR_AGING_31_60,
  COLOR_AGING_61_90,
  COLOR_AGING_OVER_90,
} from './invoice-debts-export-styles.helper';

describe('invoice-debts-export-styles.helper', () => {
  describe('getDebtSummaryColumns', () => {
    it('should return 16 columns with proper labels for customer', () => {
      const cols = getDebtSummaryColumns(false);
      expect(cols.length).toBe(16);
      expect(cols[1].header).toBe('Tên khách hàng');
      expect(cols[5].header).toBe('Tổng phải thu');
      expect(cols[8].headerFill).toBe(COLOR_AGING_0_30);
      expect(cols[9].headerFill).toBe(COLOR_AGING_31_60);
      expect(cols[10].headerFill).toBe(COLOR_AGING_61_90);
      expect(cols[11].headerFill).toBe(COLOR_AGING_OVER_90);
    });

    it('should return 16 columns with proper labels for supplier', () => {
      const cols = getDebtSummaryColumns(true);
      expect(cols.length).toBe(16);
      expect(cols[1].header).toBe('Tên nhà cung cấp');
      expect(cols[5].header).toBe('Tổng phải trả');
    });
  });

  describe('getDebtDetailColumns', () => {
    it('should return 18 columns with proper aging header fills', () => {
      const cols = getDebtDetailColumns(false);
      expect(cols.length).toBe(18);
      expect(cols[12].headerFill).toBe(COLOR_AGING_0_30);
      expect(cols[13].headerFill).toBe(COLOR_AGING_31_60);
      expect(cols[14].headerFill).toBe(COLOR_AGING_61_90);
      expect(cols[15].headerFill).toBe(COLOR_AGING_OVER_90);
    });
  });

  describe('initSheetStructure & finalizeSheetLayout', () => {
    it('should configure 4 top rows with SUM, SUBTOTAL, blank, header and freeze panes', () => {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('Test');
      const cols = getDebtSummaryColumns(false);

      initSheetStructure(sheet, cols);

      // Add dummy data row
      const dataRow = sheet.addRow([]);
      formatSummaryDataRow(
        dataRow,
        {
          partnerName: 'Công ty ABC',
          taxCode: '0123456789',
          address: 'Hà Nội',
          invoiceCount: 5,
          totalAmount: 100000000,
          paidAmount: 60000000,
          balanceAmount: 40000000,
          aging0To30: 20000000,
          aging31To60: 20000000,
          aging61To90: 0,
          agingOver90: 0,
          maxAgingDays: 45,
          weightedAgingDays: 30,
          latestInvoiceDate: '2026-08-10',
        },
        0,
      );

      finalizeSheetLayout(
        sheet,
        cols,
        {
          invoiceCount: 5,
          totalAmount: 100000000,
          paidAmount: 60000000,
          balanceAmount: 40000000,
          aging0To30: 20000000,
          aging31To60: 20000000,
          aging61To90: 0,
          agingOver90: 0,
        },
        2,
      );

      expect((sheet.views?.[0] as any)?.ySplit).toBe(4);
      expect((sheet.views?.[0] as any)?.state).toBe('frozen');

      // Row 1: SUM
      expect(sheet.getRow(1).getCell(2).value).toBe('TỔNG CỘNG (SUM)');
      expect((sheet.getRow(1).getCell(6).value as any)?.formula).toBe(
        'SUM(F5:F5)',
      );
      expect((sheet.getRow(1).getCell(6).value as any)?.result).toBe(100000000);

      // Row 2: SUBTOTAL
      expect(sheet.getRow(2).getCell(2).value).toBe(
        'TỔNG THEO BỘ LỌC (SUBTOTAL)',
      );
      expect((sheet.getRow(2).getCell(6).value as any)?.formula).toBe(
        'SUBTOTAL(9,F5:F5)',
      );
      expect((sheet.getRow(2).getCell(6).value as any)?.result).toBe(100000000);

      // Row 4: Header
      expect(sheet.getRow(4).getCell(1).value).toBe('STT');
      expect((sheet.getRow(4).getCell(1).fill as any)?.fgColor?.argb).toBe(
        COLOR_HEADER_DEFAULT,
      );
      expect((sheet.getRow(4).getCell(9).fill as any)?.fgColor?.argb).toBe(
        COLOR_AGING_0_30,
      );
    });
  });

  describe('formatDetailDataRow', () => {
    it('should format detailed invoice row correctly', () => {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet('DetailTest');
      const row = sheet.addRow([]);

      formatDetailDataRow(
        row,
        {
          sellerName: 'Nhà cung cấp ABC',
          sellerTaxCode: '0109999999',
          buyerName: 'Khách hàng XYZ',
          buyerTaxCode: '0308888888',
          invoiceDate: '2026-08-15',
          serialNo: '1C26TGA',
          invoiceNo: '0000123',
          description: 'Hàng hóa dịch vụ',
          preVatAmount: 10000000,
          vatAmount: 1000000,
          totalAmount: 11000000,
          paidAmount: 5000000,
          balanceAmount: 6000000,
          agingDays: 40,
          status: 'ACTIVE',
        },
        0,
        false,
      );

      expect(row.getCell(1).value).toBe(1);
      expect(row.getCell(2).value).toBe('0308888888');
      expect(row.getCell(3).value).toBe('Khách hàng XYZ');
      expect(row.getCell(12).value).toBe(6000000);
      expect(row.getCell(14).value).toBe(6000000); // 31-60 days aging
      expect(row.getCell(17).value).toBe(40);
    });
  });
});
