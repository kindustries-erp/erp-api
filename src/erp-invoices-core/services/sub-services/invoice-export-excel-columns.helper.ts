import * as ExcelJS from 'exceljs';
import { getExcelColumnLetter } from './invoice-query-helpers';

export const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

export const formatTaxInvoiceStatus = (val?: number | null) => {
  switch (val) {
    case 1:
      return 'Mới';
    case 2:
      return 'Thay thế';
    case 3:
      return 'Điều chỉnh';
    case 4:
      return 'Bị thay thế';
    case 5:
      return 'Bị điều chỉnh';
    case 6:
      return 'Bị hủy';
    default:
      return val?.toString() || '—';
  }
};

export const INVOICE_TYPE_MAP: Record<string, string> = {
  CHIET_KHAU: 'Hóa đơn chiết khấu',
  DICH_VU_CUU_HO: 'Hóa đơn cứu hộ',
  HANG_HOA: 'Hàng hóa / Vật tư',
  DICH_VU: 'Dịch vụ',
  PHI_THUE: 'Phí & Thuế',
  CUU_HO: 'Cứu hộ',
  KHAC: 'Khác',
};

export const summaryColumns = [
  { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
  { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
  { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
  { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
  { header: 'MST khách hàng', key: 'taxCode', width: 15 },
  { header: 'Địa chỉ khách hàng', key: 'address', width: 50 },
  {
    header: 'Chiết khấu',
    key: 'headerDiscountAmount',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Trước thuế GTGT',
    key: 'preVat',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Thuế suất',
    key: 'vatRate',
    width: 15,
    style: { numFmt: '0%' },
  },
  {
    header: 'Thuế GTGT',
    key: 'vat',
    width: 15,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Thành tiền',
    key: 'total',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  { header: 'Biển số xe', key: 'licensePlate', width: 15 },
  { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
  { header: 'Diễn giải', key: 'description', width: 50 },
  { header: 'Trạng thái', key: 'statusName', width: 20 },
  { header: 'Chi nhánh', key: 'branchName', width: 25 },
  {
    header: 'Tham chiếu cấn trừ',
    key: 'netOffReferences',
    width: 25,
  },
  {
    header: 'Ngày giao dịch',
    key: 'netOffTransDate',
    width: 18,
  },
  {
    header: 'Nội dung giao dịch',
    key: 'netOffTransDesc',
    width: 45,
  },
  {
    header: 'Số tiền của tham chiếu',
    key: 'netOffRefAmount',
    width: 25,
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Số tiền cấn trừ',
    key: 'netOffAmount',
    width: 22,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Còn lại',
    key: 'remainingAmount',
    width: 22,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
];

export const detailedColumns = [
  { header: 'Ngày phát hành', key: 'invoiceDate', width: 15 },
  { header: 'Mã hàng hóa', key: 'itemCode', width: 20 },
  { header: 'Tên hàng hóa, dịch vụ', key: 'itemName', width: 40 },
  { header: 'Đơn vị tính', key: 'uom', width: 15 },
  { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
  { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
  { header: 'Tên đơn vị khách hàng', key: 'partnerName', width: 40 },
  { header: 'MST khách hàng', key: 'taxCode', width: 15 },
  {
    header: 'Số lượng',
    key: 'qty',
    width: 15,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Đơn giá',
    key: 'unitPrice',
    width: 20,
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Trước thuế GTGT',
    key: 'preVatAmount',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Thuế suất',
    key: 'vatRate',
    width: 15,
    style: { numFmt: '0%' },
  },
  {
    header: 'Thuế GTGT',
    key: 'vatAmount',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Thành tiền',
    key: 'totalAmount',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  { header: 'Biển số xe', key: 'licensePlate', width: 15 },
  { header: 'Lệnh quyết toán', key: 'wo', width: 30 },
  { header: 'Diễn giải', key: 'description', width: 50 },
  { header: 'Trạng thái', key: 'statusName', width: 20 },
  { header: 'Chi nhánh', key: 'branchName', width: 25 },
  { header: 'Phân loại dòng', key: 'invoiceSubcategory', width: 20 },
];

export const overviewColumns = [
  { header: 'Mã hàng hóa', key: 'itemCode', width: 20 },
  { header: 'Tên hàng hóa, dịch vụ', key: 'itemName', width: 45 },
  { header: 'Đơn vị tính', key: 'uom', width: 15 },
  {
    header: 'Số lượng',
    key: 'totalQty',
    width: 18,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Đơn giá bình quân',
    key: 'avgUnitPrice',
    width: 20,
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Trước thuế GTGT',
    key: 'totalPreVat',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Thuế GTGT',
    key: 'totalVat',
    width: 18,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Thành tiền',
    key: 'totalAmount',
    width: 20,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Số dòng',
    key: 'lineCount',
    width: 12,
    style: { numFmt: '#,##0' },
    isCount: true,
  },
];

export const debtColumns = [
  { header: 'STT', key: 'stt', width: 8 },
  { header: 'Mã số thuế', key: 'taxCode', width: 18 },
  { header: 'Tên đối tác', key: 'partnerName', width: 45 },
  {
    header: 'Số lượng HĐ',
    key: 'invoiceCount',
    width: 15,
    style: { numFmt: '#,##0' },
    isCount: true,
  },
  {
    header: 'Tổng tiền hóa đơn',
    key: 'totalAmount',
    width: 22,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Đã cấn trừ',
    key: 'netOffAmount',
    width: 22,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Còn lại',
    key: 'remainingAmount',
    width: 22,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Lũy kế công nợ',
    key: 'cumulativeDebt',
    width: 24,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Lũy kế cấn trừ',
    key: 'cumulativeNetOff',
    width: 24,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  {
    header: 'Lũy kế còn nợ',
    key: 'cumulativeRemaining',
    width: 24,
    style: { numFmt: '#,##0.00' },
    isSum: true,
  },
  { header: 'Trạng thái', key: 'status', width: 16 },
];

export const initSheetStructure = (
  sheet: ExcelJS.Worksheet,
  columns: Array<{ key: string; width?: number }>,
) => {
  sheet.columns = columns.map((c) => ({
    key: c.key,
    width: c.width,
  }));
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
};

export const finalizeSheetLayout = (
  sheet: ExcelJS.Worksheet,
  columns: Array<{
    header: string;
    key: string;
    width: number;
    style?: { numFmt?: string };
    isSum?: boolean;
    isCount?: boolean;
  }>,
  calculatedSums: Record<string, number>,
  labelColIndex = 3,
) => {
  const totalCols = columns.length;
  const startRow = 5;
  const endRow = Math.max(startRow, sheet.rowCount);

  const sumRow = sheet.getRow(1);
  sumRow.height = 22;
  sumRow.font = {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF0F172A' },
  };

  const subtotalRow = sheet.getRow(2);
  subtotalRow.height = 22;
  subtotalRow.font = {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF1E40AF' },
  };

  const blankRow = sheet.getRow(3);
  blankRow.height = 10;

  const headerRow = sheet.getRow(4);
  headerRow.height = 28;
  headerRow.font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  for (let c = 1; c <= totalCols; c++) {
    const colDef = columns[c - 1];
    const colLetter = getExcelColumnLetter(c);

    const cellSum = sumRow.getCell(c);
    cellSum.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cellSum.border = borderThin;

    const cellSub = subtotalRow.getCell(c);
    cellSub.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };
    cellSub.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    const cellHdr = headerRow.getCell(c);
    cellHdr.value = colDef.header;
    cellHdr.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };
    cellHdr.border = borderThin;

    if (c === labelColIndex) {
      cellSum.value = 'TỔNG CỘNG (SUM)';
      cellSum.alignment = { horizontal: 'left', vertical: 'middle' };
      cellSub.value = 'TỔNG THEO BỘ LỌC (SUBTOTAL)';
      cellSub.alignment = { horizontal: 'left', vertical: 'middle' };
    }

    if (colDef.isSum) {
      const sumVal = calculatedSums[colDef.key] || 0;
      cellSum.value = {
        formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
        result: sumVal,
      };
      cellSum.alignment = { horizontal: 'right', vertical: 'middle' };
      cellSum.numFmt = colDef.style?.numFmt || '#,##0.00';

      cellSub.value = {
        formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
        result: sumVal,
      };
      cellSub.alignment = { horizontal: 'right', vertical: 'middle' };
      cellSub.numFmt = colDef.style?.numFmt || '#,##0.00';
    } else if (colDef.isCount) {
      const sumVal = calculatedSums[colDef.key] || 0;
      cellSum.value = {
        formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
        result: sumVal,
      };
      cellSum.alignment = { horizontal: 'center', vertical: 'middle' };
      cellSum.numFmt = colDef.style?.numFmt || '#,##0';

      cellSub.value = {
        formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
        result: sumVal,
      };
      cellSub.alignment = { horizontal: 'center', vertical: 'middle' };
      cellSub.numFmt = colDef.style?.numFmt || '#,##0';
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: endRow, column: totalCols },
  };
};

export const createOverviewAccumulator =
  (map: Map<string, any>) =>
  (payload: {
    itemCode?: string;
    itemName: string;
    uom: string;
    qty: number;
    unitPrice: number;
    preVatAmount: number;
    vatAmount: number;
    totalAmount: number;
  }) => {
    const itemCode = String(payload.itemCode || '').trim();
    const itemName = String(payload.itemName || '').trim() || '(Không có tên)';
    const uom = String(payload.uom || '')
      .trim()
      .toUpperCase();
    const key = `${itemCode.toLowerCase()}__${itemName.toLowerCase()}__${uom.toLowerCase()}`;

    const current = map.get(key) || {
      itemCode,
      itemName,
      uom,
      totalQty: 0,
      totalPreVat: 0,
      totalVat: 0,
      totalAmount: 0,
      totalUnitPriceWeight: 0,
      lineCount: 0,
    };

    const qty = Number(payload.qty) || 0;
    const unitPrice = Number(payload.unitPrice) || 0;

    current.totalQty += qty;
    current.totalPreVat += Number(payload.preVatAmount) || 0;
    current.totalVat += Number(payload.vatAmount) || 0;
    current.totalAmount += Number(payload.totalAmount) || 0;
    current.totalUnitPriceWeight += unitPrice * qty;
    current.lineCount += 1;

    map.set(key, current);
  };
