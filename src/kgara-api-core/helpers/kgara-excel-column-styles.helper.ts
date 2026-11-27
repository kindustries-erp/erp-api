import * as ExcelJS from 'exceljs';

import {
  borderThin,
  type ExcelReportColumnDef,
} from './kgara-excel-layout.helper';

/** Màu theo nhóm cột của Sheet 1: header, dòng SUM/SUBTOTAL và thân bảng (ARGB). */
export interface ColumnGroupPalette {
  header: string;
  summary: string;
  body: string;
}

/** Nhóm cột Sheet 1; cột không thuộc nhóm nào giữ màu mặc định. */
export const COMPLETED_CASES_COLUMN_GROUPS: Record<
  'receivable' | 'payable' | 'profit',
  { palette: ColumnGroupPalette; keys: string[] }
> = {
  receivable: {
    palette: { header: 'FF047857', summary: 'FFD1FAE5', body: 'FFECFDF5' },
    keys: [
      'phaiThuBaoHiem',
      'phaiThuKhachHang',
      'phaiThu',
      'daThu',
      'conPhaiThu',
      'ghiChuThu',
    ],
  },
  payable: {
    palette: { header: 'FFBE123C', summary: 'FFFFE4E6', body: 'FFFFF1F2' },
    keys: [
      'chiPhiNhanCong',
      'chiPhiPhuTung',
      'phaiTra',
      'daTra',
      'conPhaiTra',
      'ghiChuTra',
    ],
  },
  profit: {
    palette: { header: 'FF6D28D9', summary: 'FFEDE9FE', body: 'FFF5F3FF' },
    keys: ['vatAmount', 'doanhThu', 'chiPhi', 'loiNhuan', 'margin'],
  },
};

/** Nhóm cột Sheet 2 (Theo dõi lãi lỗ): dùng lại palette của Sheet 1 để hai sheet nhất quán. */
export const CASE_PNL_COLUMN_GROUPS: Record<
  'revenue' | 'cost' | 'profit',
  { palette: ColumnGroupPalette; keys: string[] }
> = {
  revenue: {
    palette: COMPLETED_CASES_COLUMN_GROUPS.receivable.palette,
    keys: ['vatAmount', 'doanhThuDichVu', 'doanhThuPhuTung', 'doanhThu'],
  },
  cost: {
    palette: COMPLETED_CASES_COLUMN_GROUPS.payable.palette,
    keys: ['giaVonPhuTung', 'chiPhiKhac', 'chiPhi'],
  },
  profit: {
    palette: COMPLETED_CASES_COLUMN_GROUPS.profit.palette,
    keys: ['loiNhuan', 'margin'],
  },
};

/**
 * Tô màu header, dòng SUM/SUBTOTAL và thân bảng theo nhóm cột. Thân chỉ tô ô chưa có
 * nền để không ghi đè ghi chú, dải Biên LN và ô trạng thái đã tô trước đó.
 * Cột không có trong `columns` (đã bị bỏ khi chọn cột) được bỏ qua.
 */
export function applyColumnGroupStyles(
  sheet: ExcelJS.Worksheet,
  columns: ExcelReportColumnDef[],
  firstDataRow = 5,
  groups: Record<
    string,
    { palette: ColumnGroupPalette; keys: string[] }
  > = COMPLETED_CASES_COLUMN_GROUPS,
): void {
  const solid = (argb: string): ExcelJS.Fill => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  });
  const endRow = Math.max(firstDataRow, sheet.rowCount);
  const hasFill = (cell: ExcelJS.Cell) =>
    Boolean(cell.fill) && (cell.fill as ExcelJS.FillPattern).pattern !== 'none';

  for (const group of Object.values(groups)) {
    for (const key of group.keys) {
      const idx = columns.findIndex((c) => c.key === key);
      if (idx < 0) continue;
      const col = idx + 1;

      sheet.getRow(4).getCell(col).fill = solid(group.palette.header);
      sheet.getRow(1).getCell(col).fill = solid(group.palette.summary);
      sheet.getRow(2).getCell(col).fill = solid(group.palette.summary);

      for (let rowNo = firstDataRow; rowNo <= endRow; rowNo++) {
        const cell = sheet.getRow(rowNo).getCell(col);
        if (!hasFill(cell)) cell.fill = solid(group.palette.body);
      }
    }
  }
}

/**
 * Tô nền vàng hổ phách cho cột tiền dự kiến (dự thu, dự chi) để phân biệt với cột thực tế.
 * Header đậm, dòng tổng và dữ liệu nhạt, chữ nghiêng nâu; giữ nguyên định dạng số và viền.
 * `columnIndex` là chỉ số cột 1-based; dòng 1-2 là tổng, dòng 4 là tiêu đề.
 */
export function applyForecastColumnStyle(
  sheet: ExcelJS.Worksheet,
  columnIndex: number,
  firstDataRow = 5,
): void {
  const solid = (argb: string): ExcelJS.Fill => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  });
  const endRow = Math.max(firstDataRow, sheet.rowCount);

  const header = sheet.getRow(4).getCell(columnIndex);
  header.fill = solid('FFB45309'); // amber 700
  header.font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  for (const rowNo of [1, 2]) {
    const cell = sheet.getRow(rowNo).getCell(columnIndex);
    cell.fill = solid('FFFEF3C7'); // amber 100
  }

  for (let rowNo = firstDataRow; rowNo <= endRow; rowNo++) {
    const cell = sheet.getRow(rowNo).getCell(columnIndex);
    cell.fill = solid('FFFFFBEB'); // amber 50
    cell.font = {
      ...(cell.font ?? {}),
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF92400E' }, // amber 800
    };
  }
}

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
