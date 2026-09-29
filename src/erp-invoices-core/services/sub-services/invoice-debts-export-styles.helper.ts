import * as ExcelJS from 'exceljs';
import { getExcelColumnLetter } from './invoice-query-helpers';

export interface DebtExportColumnDef {
  header: string;
  key: string;
  width: number;
  style?: { numFmt?: string };
  isSum?: boolean;
  isCount?: boolean;
  headerFill?: string;
}

export const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

export const COLOR_HEADER_DEFAULT = 'FF334155'; // Slate-700
export const COLOR_AGING_0_30 = 'FF059669'; // Emerald
export const COLOR_AGING_31_60 = 'FFD97706'; // Amber
export const COLOR_AGING_61_90 = 'FFEA580C'; // Orange
export const COLOR_AGING_OVER_90 = 'FFE11D48'; // Rose

/**
 * Định nghĩa danh sách các cột cho Sheet 1: Tổng hợp công nợ
 */
export function getDebtSummaryColumns(
  isSupplier: boolean,
): DebtExportColumnDef[] {
  return [
    { header: 'STT', key: 'stt', width: 8 },
    {
      header: isSupplier ? 'Tên nhà cung cấp' : 'Tên khách hàng',
      key: 'partnerName',
      width: 38,
    },
    { header: 'Mã số thuế / CCCD', key: 'taxCode', width: 18 },
    { header: 'Địa chỉ', key: 'address', width: 32 },
    {
      header: 'SL Hóa đơn',
      key: 'invoiceCount',
      width: 14,
      style: { numFmt: '#,##0' },
      isCount: true,
    },
    {
      header: isSupplier ? 'Tổng phải trả' : 'Tổng phải thu',
      key: 'totalAmount',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: isSupplier ? 'Đã trả' : 'Đã thu',
      key: 'paidAmount',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: isSupplier ? 'Còn phải trả' : 'Còn phải thu',
      key: 'balanceAmount',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: 'Nợ 0-30 ngày',
      key: 'aging0To30',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_0_30,
    },
    {
      header: 'Nợ 31-60 ngày',
      key: 'aging31To60',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_31_60,
    },
    {
      header: 'Nợ 61-90 ngày',
      key: 'aging61To90',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_61_90,
    },
    {
      header: 'Nợ >90 ngày',
      key: 'agingOver90',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_OVER_90,
    },
    { header: 'Tuổi nợ max (ngày)', key: 'maxAgingDays', width: 16 },
    { header: 'Tuổi nợ BQ (ngày)', key: 'weightedAgingDays', width: 16 },
    { header: 'Đánh giá rủi ro', key: 'agingCategory', width: 28 },
    { header: 'Ngày HĐ gần nhất', key: 'latestInvoiceDate', width: 16 },
  ];
}

/**
 * Định nghĩa danh sách các cột cho Sheet 2: Chi tiết hóa đơn đối tác
 */
export function getDebtDetailColumns(
  isSupplier: boolean,
): DebtExportColumnDef[] {
  return [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Mã số thuế', key: 'taxCode', width: 18 },
    {
      header: isSupplier ? 'Tên nhà cung cấp' : 'Tên đối tác',
      key: 'partnerName',
      width: 35,
    },
    { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
    { header: 'Ký hiệu HĐ', key: 'serialNo', width: 14 },
    { header: 'Số hóa đơn', key: 'invoiceNo', width: 16 },
    { header: 'Diễn giải', key: 'description', width: 36 },
    {
      header: 'Tiền trước thuế',
      key: 'preVatAmount',
      width: 20,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: 'Thuế VAT',
      key: 'vatAmount',
      width: 18,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: 'Tổng tiền HĐ',
      key: 'totalAmount',
      width: 22,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: 'Đã thanh toán',
      key: 'paidAmount',
      width: 20,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: 'Còn lại',
      key: 'balanceAmount',
      width: 20,
      style: { numFmt: '#,##0.00' },
      isSum: true,
    },
    {
      header: '0-30 ngày',
      key: 'aging0To30',
      width: 18,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_0_30,
    },
    {
      header: '31-60 ngày',
      key: 'aging31To60',
      width: 18,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_31_60,
    },
    {
      header: '61-90 ngày',
      key: 'aging61To90',
      width: 18,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_61_90,
    },
    {
      header: '>90 ngày',
      key: 'agingOver90',
      width: 18,
      style: { numFmt: '#,##0.00' },
      isSum: true,
      headerFill: COLOR_AGING_OVER_90,
    },
    { header: 'Tuổi nợ (ngày)', key: 'agingDays', width: 14 },
    { header: 'Trạng thái', key: 'status', width: 15 },
  ];
}

/**
 * Khởi tạo cấu trúc 4 hàng đầu của trang tính (SUM, SUBTOTAL, Blank, Header)
 */
export function initSheetStructure(
  sheet: ExcelJS.Worksheet,
  columns: DebtExportColumnDef[],
): void {
  sheet.columns = columns.map((c) => ({
    key: c.key,
    width: c.width,
  }));
  sheet.addRow([]); // Row 1: SUM
  sheet.addRow([]); // Row 2: SUBTOTAL
  sheet.addRow([]); // Row 3: Blank
  sheet.addRow([]); // Row 4: Header
}

/**
 * Hoàn thiện định dạng 4 hàng đầu, ghim cố định và bộ lọc tự động
 */
export function finalizeSheetLayout(
  sheet: ExcelJS.Worksheet,
  columns: DebtExportColumnDef[],
  calculatedSums: Record<string, number>,
  labelColIndex = 2,
): void {
  const totalCols = columns.length;
  const startRow = 5;
  const endRow = Math.max(startRow, sheet.rowCount);

  // Row 1: SUM
  const sumRow = sheet.getRow(1);
  sumRow.height = 22;
  sumRow.font = {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF0F172A' },
  };

  // Row 2: SUBTOTAL
  const subtotalRow = sheet.getRow(2);
  subtotalRow.height = 22;
  subtotalRow.font = {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF1E40AF' },
  };

  // Row 3: Blank spacing row
  const blankRow = sheet.getRow(3);
  blankRow.height = 10;

  // Row 4: Table Header
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

    // Style Cell SUM
    const cellSum = sumRow.getCell(c);
    cellSum.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cellSum.border = borderThin;

    // Style Cell SUBTOTAL
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

    // Style Cell Header
    const cellHdr = headerRow.getCell(c);
    cellHdr.value = colDef.header;
    cellHdr.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colDef.headerFill || COLOR_HEADER_DEFAULT },
    };
    cellHdr.border = borderThin;

    // Label Placement
    if (c === labelColIndex) {
      cellSum.value = 'TỔNG CỘNG (SUM)';
      cellSum.alignment = { horizontal: 'left', vertical: 'middle' };
      cellSub.value = 'TỔNG THEO BỘ LỌC (SUBTOTAL)';
      cellSub.alignment = { horizontal: 'left', vertical: 'middle' };
    }

    // Formulas
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
      const countVal = calculatedSums[colDef.key] || 0;
      cellSum.value = {
        formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
        result: countVal,
      };
      cellSum.alignment = { horizontal: 'center', vertical: 'middle' };
      cellSum.numFmt = colDef.style?.numFmt || '#,##0';

      cellSub.value = {
        formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
        result: countVal,
      };
      cellSub.alignment = { horizontal: 'center', vertical: 'middle' };
      cellSub.numFmt = colDef.style?.numFmt || '#,##0';
    }
  }

  // Freeze top 4 rows
  sheet.views = [{ state: 'frozen', ySplit: 4 }];

  // AutoFilter from header row
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: endRow, column: totalCols },
  };
}

/**
 * Định dạng một dòng dữ liệu tổng hợp công nợ (Sheet 1)
 */
export function formatSummaryDataRow(
  row: ExcelJS.Row,
  p: any,
  idx: number,
): void {
  const bal = Number(p.balanceAmount) || 0;
  const aging = Number(p.maxAgingDays) || 0;
  const weightedAging = Number(p.weightedAgingDays) || 0;
  const a0_30 = Number(p.aging0To30) || 0;
  const a31_60 = Number(p.aging31To60) || 0;
  const a61_90 = Number(p.aging61To90) || 0;
  const aOver90 = Number(p.agingOver90) || 0;

  let agingCategory = 'Đã tất toán (0% nợ)';
  if (bal > 0) {
    if (aOver90 > 0 && aOver90 >= bal * 0.99) {
      agingCategory = '>90 ngày (Nợ xấu / Nghiêm trọng)';
    } else if (aOver90 > 0) {
      agingCategory = 'Đa tầng (Có nợ quá hạn >90d)';
    } else if (a61_90 > 0) {
      agingCategory = '61-90 ngày (Quá hạn)';
    } else if (a31_60 > 0) {
      agingCategory = '31-60 ngày (Cần theo dõi)';
    } else {
      agingCategory = '0-30 ngày (Trong hạn 100%)';
    }
  }

  row.values = [
    idx + 1,
    p.partnerName || '—',
    p.taxCode === 'KHONG_MST' ? '—' : p.taxCode,
    p.address || '—',
    Number(p.invoiceCount) || 0,
    Number(p.totalAmount) || 0,
    Number(p.paidAmount) || 0,
    bal,
    a0_30,
    a31_60,
    a61_90,
    aOver90,
    bal > 0 ? aging : 0,
    bal > 0 ? weightedAging : 0,
    agingCategory,
    p.latestInvoiceDate || '—',
  ];

  row.height = 20;
  row.font = { name: 'Calibri', size: 10 };

  row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
  row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(5).numFmt = '#,##0';
  row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(6).numFmt = '#,##0.00';
  row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(7).numFmt = '#,##0.00';
  row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(8).numFmt = '#,##0.00';
  row.getCell(8).font = {
    name: 'Calibri',
    size: 10,
    bold: bal > 0,
    color: { argb: bal > 0 ? 'FFDC2626' : 'FF059669' },
  };

  // Aging columns pastel background tints
  row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(9).numFmt = '#,##0.00';
  row.getCell(9).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0FDF4' },
  };
  row.getCell(9).font = {
    name: 'Calibri',
    size: 10,
    bold: a0_30 > 0,
    color: { argb: a0_30 > 0 ? 'FF065F46' : 'FF94A3B8' },
  };

  row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(10).numFmt = '#,##0.00';
  row.getCell(10).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFBEB' },
  };
  row.getCell(10).font = {
    name: 'Calibri',
    size: 10,
    bold: a31_60 > 0,
    color: { argb: a31_60 > 0 ? 'FF92400E' : 'FF94A3B8' },
  };

  row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(11).numFmt = '#,##0.00';
  row.getCell(11).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF7ED' },
  };
  row.getCell(11).font = {
    name: 'Calibri',
    size: 10,
    bold: a61_90 > 0,
    color: { argb: a61_90 > 0 ? 'FF9A3412' : 'FF94A3B8' },
  };

  row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(12).numFmt = '#,##0.00';
  row.getCell(12).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF1F2' },
  };
  row.getCell(12).font = {
    name: 'Calibri',
    size: 10,
    bold: aOver90 > 0,
    color: { argb: aOver90 > 0 ? 'FF9F1239' : 'FF94A3B8' },
  };

  row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(13).numFmt = '#,##0';
  row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(14).numFmt = '#,##0';
  row.getCell(15).alignment = { horizontal: 'left', vertical: 'middle' };
  row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 16; c++) {
    row.getCell(c).border = borderThin;
  }
}

/**
 * Định dạng một dòng dữ liệu chi tiết hóa đơn (Sheet 2)
 */
export function formatDetailDataRow(
  row: ExcelJS.Row,
  inv: any,
  idx: number,
  isSupplier: boolean,
): void {
  const pName = isSupplier ? inv.sellerName : inv.buyerName;
  const tCode = isSupplier ? inv.sellerTaxCode : inv.buyerTaxCode;
  const bal = Number(inv.balanceAmount) || 0;
  const aging = Number(inv.agingDays) || 0;

  const a0_30 = bal > 0 && aging <= 30 ? bal : 0;
  const a31_60 = bal > 0 && aging > 30 && aging <= 60 ? bal : 0;
  const a61_90 = bal > 0 && aging > 60 && aging <= 90 ? bal : 0;
  const aOver90 = bal > 0 && aging > 90 ? bal : 0;

  row.values = [
    idx + 1,
    tCode === 'KHONG_MST' ? '—' : tCode,
    pName || '—',
    inv.invoiceDate,
    inv.serialNo || '—',
    inv.invoiceNo || '—',
    inv.description || '—',
    Number(inv.preVatAmount) || 0,
    Number(inv.vatAmount) || 0,
    Number(inv.totalAmount) || 0,
    Number(inv.paidAmount) || 0,
    bal,
    a0_30,
    a31_60,
    a61_90,
    aOver90,
    bal > 0 ? aging : 0,
    inv.status || 'ACTIVE',
  ];

  row.height = 20;
  row.font = { name: 'Calibri', size: 10 };

  row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
  row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
  row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(8).numFmt = '#,##0.00';
  row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(9).numFmt = '#,##0.00';
  row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(10).numFmt = '#,##0.00';
  row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(11).numFmt = '#,##0.00';
  row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(12).numFmt = '#,##0.00';

  // Aging columns tints
  row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(13).numFmt = '#,##0.00';
  row.getCell(13).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0FDF4' },
  };
  row.getCell(13).font = {
    name: 'Calibri',
    size: 10,
    bold: a0_30 > 0,
    color: { argb: a0_30 > 0 ? 'FF065F46' : 'FF94A3B8' },
  };

  row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(14).numFmt = '#,##0.00';
  row.getCell(14).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFBEB' },
  };
  row.getCell(14).font = {
    name: 'Calibri',
    size: 10,
    bold: a31_60 > 0,
    color: { argb: a31_60 > 0 ? 'FF92400E' : 'FF94A3B8' },
  };

  row.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(15).numFmt = '#,##0.00';
  row.getCell(15).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF7ED' },
  };
  row.getCell(15).font = {
    name: 'Calibri',
    size: 10,
    bold: a61_90 > 0,
    color: { argb: a61_90 > 0 ? 'FF9A3412' : 'FF94A3B8' },
  };

  row.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
  row.getCell(16).numFmt = '#,##0.00';
  row.getCell(16).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF1F2' },
  };
  row.getCell(16).font = {
    name: 'Calibri',
    size: 10,
    bold: aOver90 > 0,
    color: { argb: aOver90 > 0 ? 'FF9F1239' : 'FF94A3B8' },
  };

  row.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(17).numFmt = '#,##0';
  row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 18; c++) {
    row.getCell(c).border = borderThin;
  }
}
