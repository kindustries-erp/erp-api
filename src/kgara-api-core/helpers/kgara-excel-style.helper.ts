import * as ExcelJS from 'exceljs';

export interface ExcelReportColumnDef {
  header: string;
  key: string;
  width: number;
  style?: { numFmt?: string };
  isSum?: boolean;
  isCount?: boolean;
  align?: 'left' | 'center' | 'right';
}

export const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

export const borderSummaryTopBottom: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'double', color: { argb: 'FF0F172A' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

/**
 * Chuyển đổi số thứ tự cột 1-based thành chữ cái cột trong Excel (1 -> A, 27 -> AA)
 */
export function getExcelColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Khởi tạo cấu trúc cột và 4 hàng trống đầu cho Worksheet
 */
export function initSheetStructure(
  sheet: ExcelJS.Worksheet,
  columns: ExcelReportColumnDef[],
): void {
  sheet.columns = columns.map((c) => ({
    key: c.key,
    width: c.width,
  }));
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);
}

/**
 * Áp dụng Layout chuẩn hóa cho Báo cáo Excel:
 * - Row 1: TỔNG CỘNG (SUM)
 * - Row 2: TỔNG THEO BỘ LỌC (SUBTOTAL)
 * - Row 3: Khoảng đệm (Blank row)
 * - Row 4: Header Table (Dark background, white text)
 * - Row 5+: Data Rows
 * - Views: Frozen 4 rows đầu
 * - AutoFilter: Bật filter từ Row 4
 */
export function applyStandardExcelReportLayout(
  sheet: ExcelJS.Worksheet,
  columns: ExcelReportColumnDef[],
  labelColIndex = 5,
  calculatedSums: Record<string, number> = {},
  customFormulas?: {
    sumRow?: Record<string, string>;
    subtotalRow?: Record<string, string>;
  },
): void {
  const totalCols = columns.length;
  const startRow = 5;
  const endRow = Math.max(startRow, sheet.rowCount);

  // Set column widths
  columns.forEach((col, idx) => {
    const sheetCol = sheet.getColumn(idx + 1);
    sheetCol.key = col.key;
    sheetCol.width = col.width;
  });

  // 1. SUM Row (Row 1)
  const sumRow = sheet.getRow(1);
  sumRow.height = 22;
  sumRow.font = {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF0F172A' },
  };

  // 2. SUBTOTAL Row (Row 2)
  const subtotalRow = sheet.getRow(2);
  subtotalRow.height = 22;
  subtotalRow.font = {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF1E40AF' },
  };

  // 3. Blank Row (Row 3)
  const blankRow = sheet.getRow(3);
  blankRow.height = 10;

  // 4. Header Row (Row 4)
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

    // Style SUM cell
    const cellSum = sumRow.getCell(c);
    cellSum.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cellSum.border = borderThin;

    // Style SUBTOTAL cell
    const cellSub = subtotalRow.getCell(c);
    cellSub.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };
    cellSub.border = borderSummaryTopBottom;

    // Style Header cell
    const cellHdr = headerRow.getCell(c);
    cellHdr.value = colDef.header;
    cellHdr.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };
    cellHdr.border = borderThin;

    // Label Column (ví dụ tên khách hàng / tên sản phẩm)
    if (c === labelColIndex) {
      cellSum.value = 'TỔNG CỘNG (SUM)';
      cellSum.alignment = { horizontal: 'left', vertical: 'middle' };
      cellSub.value = 'TỔNG THEO BỘ LỌC (SUBTOTAL)';
      cellSub.alignment = { horizontal: 'left', vertical: 'middle' };
    }

    // Formulas cho SUM
    if (customFormulas?.sumRow?.[colDef.key]) {
      cellSum.value = {
        formula: customFormulas.sumRow[colDef.key],
        result: calculatedSums[colDef.key],
      };
      cellSum.alignment = {
        horizontal: colDef.align || 'right',
        vertical: 'middle',
      };
      cellSum.numFmt = colDef.style?.numFmt || '#,##0';
    } else if (colDef.isSum) {
      const sumVal = calculatedSums[colDef.key] || 0;
      cellSum.value = {
        formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
        result: sumVal,
      };
      cellSum.alignment = {
        horizontal: colDef.align || 'right',
        vertical: 'middle',
      };
      cellSum.numFmt = colDef.style?.numFmt || '#,##0';
    }

    // Formulas cho SUBTOTAL
    if (customFormulas?.subtotalRow?.[colDef.key]) {
      cellSub.value = {
        formula: customFormulas.subtotalRow[colDef.key],
        result: calculatedSums[colDef.key],
      };
      cellSub.alignment = {
        horizontal: colDef.align || 'right',
        vertical: 'middle',
      };
      cellSub.numFmt = colDef.style?.numFmt || '#,##0';
    } else if (colDef.isSum) {
      const sumVal = calculatedSums[colDef.key] || 0;
      cellSub.value = {
        formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
        result: sumVal,
      };
      cellSub.alignment = {
        horizontal: colDef.align || 'right',
        vertical: 'middle',
      };
      cellSub.numFmt = colDef.style?.numFmt || '#,##0';
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: endRow, column: totalCols },
  };
}

/**
 * Định nghĩa cột chuẩn cho Sheet 1: Bảng kê phiếu kết thúc
 */
export const COMPLETED_CASES_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'index', width: 8, align: 'center' },
  { header: 'Số phiếu', key: 'soChungTu', width: 18, align: 'left' },
  { header: 'Biển số xe', key: 'bienSoXe', width: 14, align: 'center' },
  { header: 'Mã KH', key: 'khachHangCode', width: 16, align: 'left' },
  { header: 'Tên khách hàng', key: 'khachHangName', width: 32, align: 'left' },
  {
    header: 'Trạng thái',
    key: 'tenTinhTrangDichVu',
    width: 18,
    align: 'center',
  },
  { header: 'Phân loại', key: 'classification', width: 18, align: 'center' },
  { header: 'Ngày tiếp nhận', key: 'ngayTiepNhan', width: 16, align: 'center' },
  {
    header: 'Ngày hoàn thành',
    key: 'ngayHoanThanhCongViec',
    width: 18,
    align: 'center',
  },
  {
    header: 'Phải thu BH (VNĐ)',
    key: 'phaiThuBaoHiem',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Phải thu KH (VNĐ)',
    key: 'phaiThuKhachHang',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Phải thu (VNĐ)',
    key: 'phaiThu',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Đã thu (VNĐ)',
    key: 'daThu',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Còn lại phải thu (VNĐ)',
    key: 'conPhaiThu',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Ghi chú thu',
    key: 'ghiChuThu',
    width: 26,
    align: 'left',
  },
  {
    header: 'Chi phí nhân công (VNĐ)',
    key: 'chiPhiNhanCong',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chi phí phụ tùng (VNĐ)',
    key: 'chiPhiPhuTung',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Phải trả (VNĐ)',
    key: 'phaiTra',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Đã trả (VNĐ)',
    key: 'daTra',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Còn lại phải trả (VNĐ)',
    key: 'conPhaiTra',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Ghi chú trả',
    key: 'ghiChuTra',
    width: 26,
    align: 'left',
  },
  {
    header: 'Doanh thu (VNĐ)',
    key: 'doanhThu',
    width: 20,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chi phí / Giá vốn (VNĐ)',
    key: 'chiPhi',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Lợi nhuận gộp (VNĐ)',
    key: 'loiNhuan',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Biên LN (%)',
    key: 'margin',
    width: 14,
    align: 'right',
    style: { numFmt: '0.0%' },
  },
  {
    header: 'Hóa đơn VAT liên kết',
    key: 'linkedInvoices',
    width: 25,
    align: 'center',
  },
  { header: 'Chi nhánh', key: 'branchName', width: 22, align: 'left' },
];

/**
 * Định nghĩa cột chuẩn cho Sheet 2: Theo dõi lãi lỗ (15 cột)
 */
export const CASE_PNL_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'index', width: 8, align: 'center' },
  { header: 'Số phiếu', key: 'soChungTu', width: 18, align: 'left' },
  { header: 'Biển số xe', key: 'bienSoXe', width: 14, align: 'center' },
  { header: 'Tên khách hàng', key: 'khachHangName', width: 32, align: 'left' },
  { header: 'Phân loại', key: 'classification', width: 18, align: 'center' },
  {
    header: 'Ngày hoàn thành',
    key: 'ngayHoanThanhCongViec',
    width: 18,
    align: 'center',
  },
  {
    header: 'Doanh thu Công DV (VNĐ)',
    key: 'doanhThuDichVu',
    width: 24,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Doanh thu Phụ tùng (VNĐ)',
    key: 'doanhThuPhuTung',
    width: 24,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tổng Doanh thu (VNĐ)',
    key: 'doanhThu',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Giá vốn Phụ tùng (VNĐ)',
    key: 'giaVonPhuTung',
    width: 24,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chi phí thợ / Khác (VNĐ)',
    key: 'chiPhiKhac',
    width: 24,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tổng Chi phí (VNĐ)',
    key: 'chiPhi',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Lợi nhuận gộp (VNĐ)',
    key: 'loiNhuan',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Biên LN (%)',
    key: 'margin',
    width: 14,
    align: 'right',
    style: { numFmt: '0.0%' },
  },
  { header: 'Chi nhánh', key: 'branchName', width: 22, align: 'left' },
];

/**
 * Áp dụng 6 dải màu background tương phản cao cho ô Biên LN (%):
 * - Dải 1: Âm / Lỗ (< 0%): Đỏ Red-200 (#FECACA / text #991B1B)
 * - Dải 2: Hòa vốn / Rất thấp (0% - 20%): Cam hổ phách Orange-200 (#FED7AA / text #9A3412)
 * - Dải 3: Trung bình (20% - 40%): Xanh da trời tươi Sky-200 (#BAE6FD / text #0369A1)
 * - Dải 4: Khá / Tốt (40% - 60%): Xanh lá mạ Green-200 (#BBF7D0 / text #15803D)
 * - Dải 5: Rất cao (60% - 80%): Xanh mòng két Teal-200 (#99F6E4 / text #0F766E)
 * - Dải 6: Xuất sắc / Siêu LN (>= 80%): Tím phong lan Purple-200 (#E9D5FF / text #6B21A8)
 */
export function styleMarginCell(
  cell: ExcelJS.Cell,
  marginPercent: number,
): void {
  cell.font = { name: 'Calibri', size: 10, bold: true };
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  cell.numFmt = '0.0%';
  cell.border = borderThin;

  if (marginPercent < 0) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFECACA' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF991B1B' },
    };
  } else if (marginPercent < 20) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFED7AA' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF9A3412' },
    };
  } else if (marginPercent < 40) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFBAE6FD' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF0369A1' },
    };
  } else if (marginPercent < 60) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFBBF7D0' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF15803D' },
    };
  } else if (marginPercent < 80) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF99F6E4' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF0F766E' },
    };
  } else {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE9D5FF' },
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF6B21A8' },
    };
  }
}

/**
 * Định nghĩa cột chuẩn cho Sheet 2: Chi tiết DV & Phụ tùng
 */
export const COMPLETED_CASE_SERVICES_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'index', width: 8, align: 'center' },
  { header: 'Số phiếu DV', key: 'soChungTu', width: 18, align: 'left' },
  { header: 'Biển số xe', key: 'bienSoXe', width: 14, align: 'center' },
  { header: 'Phân loại', key: 'loaiHienThi', width: 14, align: 'center' },
  { header: 'Mã SKU / Mã DV', key: 'sanPhamCode', width: 18, align: 'left' },
  {
    header: 'Tên sản phẩm / Công việc',
    key: 'sanPhamName',
    width: 34,
    align: 'left',
  },
  {
    header: 'Nội dung chi tiết',
    key: 'noiDungChiTiet',
    width: 30,
    align: 'left',
  },
  { header: 'ĐVT', key: 'donViTinhText', width: 10, align: 'center' },
  {
    header: 'Số lượng',
    key: 'soLuongHoaDon',
    width: 12,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Đơn giá (VNĐ)',
    key: 'donGia',
    width: 16,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Thành tiền trước thuế (VNĐ)',
    key: 'tienChuaThue',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Thuế suất',
    key: 'thueSuat',
    width: 12,
    align: 'center',
    style: { numFmt: '0.0%' },
  },
  {
    header: 'Thành tiền có thuế (VNĐ)',
    key: 'tienCoThue',
    width: 22,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Giờ công',
    key: 'soGioCongLam',
    width: 12,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tiền công DV (VNĐ)',
    key: 'tienDichVu',
    width: 18,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tiền phụ tùng (VNĐ)',
    key: 'tienPhuTung',
    width: 18,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Giá vốn PT (VNĐ)',
    key: 'giaVonPhuTung',
    width: 18,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chiết khấu (VNĐ)',
    key: 'tienChietKhauCt',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  { header: 'Mã kho', key: 'khoCode', width: 14, align: 'center' },
  { header: 'Ghi chú / Phụ phí', key: 'ghiChu', width: 20, align: 'left' },
];

/**
 * Định nghĩa cột chuẩn cho Case Services Excel xuất độc lập (24 cột)
 */
export const CASE_SERVICES_EXPORT_COLUMNS: ExcelReportColumnDef[] = [
  { header: 'STT', key: 'index', width: 6, align: 'center' },
  { header: 'Ngày tiếp nhận', key: 'caseDate', width: 15, align: 'center' },
  {
    header: 'Ngày kết thúc',
    key: 'completionDate',
    width: 15,
    align: 'center',
  },
  { header: 'Số phiếu DV', key: 'soChungTu', width: 22, align: 'left' },
  { header: 'Biển số xe', key: 'bienSoXe', width: 14, align: 'center' },
  { header: 'Khách hàng', key: 'khachHangName', width: 28, align: 'left' },
  { header: 'Loại', key: 'loaiHienThi', width: 14, align: 'center' },
  { header: 'Mã hạng mục', key: 'sanPhamCode', width: 18, align: 'left' },
  { header: 'Tên hạng mục', key: 'sanPhamName', width: 30, align: 'left' },
  {
    header: 'Diễn giải chi tiết',
    key: 'noiDungChiTiet',
    width: 35,
    align: 'left',
  },
  { header: 'ĐVT', key: 'donViTinhText', width: 10, align: 'center' },
  {
    header: 'Số lượng',
    key: 'soLuongHoaDon',
    width: 12,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Đơn giá',
    key: 'donGia',
    width: 15,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tiền trước thuế',
    key: 'tienChuaThue',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Thuế suất (%)',
    key: 'thueSuat',
    width: 14,
    align: 'center',
    style: { numFmt: '0.0%' },
  },
  {
    header: 'Thành tiền',
    key: 'tienCoThue',
    width: 18,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tiền công DV',
    key: 'tienDichVu',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Tiền phụ tùng',
    key: 'tienPhuTung',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Giá vốn PT',
    key: 'giaVonPhuTung',
    width: 16,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  {
    header: 'Chiết khấu',
    key: 'tienChietKhauCt',
    width: 14,
    isSum: true,
    align: 'right',
    style: { numFmt: '#,##0.00' },
  },
  { header: 'Mã kho', key: 'khoCode', width: 14, align: 'center' },
  { header: 'Chi nhánh', key: 'branchName', width: 22, align: 'left' },
  { header: 'Trạng thái', key: 'statusName', width: 16, align: 'center' },
  { header: 'Phân loại', key: 'classification', width: 18, align: 'center' },
];

/**
 * Sinh tên file Excel bảng kê phiếu dịch vụ chuẩn hóa kèm phân loại và trạng thái
 * Format: Bang_ke_phieu_dich_vu_{PhanLoai}_{TrangThai}_{YYYYMMDD}_{HHmmss}.xlsx
 */
export function buildGarageCaseExportFileName(
  classification?: string,
  status?: string,
  date: Date = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const timestamp = `${y}${m}${d}_${hh}${mm}${ss}`;

  let classLabel = 'Tat_ca_phan_loai';
  if (classification && classification !== 'ALL') {
    switch (classification) {
      case 'KY_GUI_NOI_BO':
        classLabel = 'Ky_gui_noi_bo';
        break;
      case 'SUA_CHUA_CHUNG':
        classLabel = 'Sua_chua_chung';
        break;
      case 'OJ':
      case 'OJ_NGOAI':
        classLabel = 'OJ';
        break;
      case 'KHAC':
        classLabel = 'Khac';
        break;
      default:
        classLabel = classification.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
  }

  let statusLabel = 'Ket_thuc';
  if (status) {
    if (status.toLowerCase() === 'all') {
      statusLabel = 'Tat_ca_trang_thai';
    } else if (status.toLowerCase() === 'completed') {
      statusLabel = 'Ket_thuc';
    } else {
      statusLabel = status.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
  }

  return `Bang_ke_phieu_dich_vu_${classLabel}_${statusLabel}_${timestamp}.xlsx`;
}
