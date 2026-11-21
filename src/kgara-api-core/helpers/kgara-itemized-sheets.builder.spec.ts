import * as ExcelJS from 'exceljs';
import {
  ITEMIZED_SHEET_NAMES,
  buildItemizedSheets,
  itemizedSheetKeyOf,
} from './kgara-itemized-sheets.builder';

const mainCase = {
  hdPhieuDichVuId: 'm1',
  soChungTu: 'GR-1',
  accountKey: 'MAIN',
};
const ojCase = { hdPhieuDichVuId: 'o1', soChungTu: 'GN-1', accountKey: 'OJ' };
const line = (unit: string, extra: Record<string, unknown> = {}) => ({
  donViTinhText: unit,
  sanPhamName: `SP ${unit}`,
  soLuongHoaDon: 1,
  tienChuaThue: 100,
  tienCoThue: 110,
  ...extra,
});

const linesMap = () =>
  new Map<string, any[]>([
    [
      'm1',
      [
        line('Cái', { loaiSanPhamCode: 'PT', tienPhuTung: 100 }),
        line('Lần'),
        line('Công'),
        line('cõng'),
        // Phụ tùng nhưng ĐVT công: theo ĐVT thì sang sheet công
        line('Công', { loaiSanPhamCode: 'PT', tienPhuTung: 0 }),
      ],
    ],
    ['o1', [line('Cái', { loaiSanPhamCode: 'PT' }), line('công')]],
  ]);

/** Số dòng dữ liệu (dưới hàng tiêu đề thứ 4, bỏ hàng tổng 1-2). */
const dataRows = (ws: ExcelJS.Worksheet) => {
  const rows: ExcelJS.Row[] = [];
  ws.eachRow((r, n) => {
    if (n > 4 && r.getCell(2).value) rows.push(r);
  });
  return rows;
};

describe('buildItemizedSheets', () => {
  it('tách công và OJ: 4 sheet, mỗi dòng đúng một sheet, tổng số dòng được bảo toàn', () => {
    const wb = new ExcelJS.Workbook();
    buildItemizedSheets(wb, [mainCase, ojCase], linesMap());

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      ITEMIZED_SHEET_NAMES.main,
      ITEMIZED_SHEET_NAMES.mainLabor,
      ITEMIZED_SHEET_NAMES.oj,
      ITEMIZED_SHEET_NAMES.ojLabor,
    ]);
    const counts = wb.worksheets.map((w) => dataRows(w).length);
    expect(counts).toEqual([2, 3, 1, 1]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(7);
  });

  it('sheet OJ chỉ chứa GN-*, sheet MAIN không còn dòng OJ', () => {
    const wb = new ExcelJS.Workbook();
    buildItemizedSheets(wb, [mainCase, ojCase], linesMap());
    const codes = (name: string) =>
      dataRows(wb.getWorksheet(name)!).map((r) => r.getCell(2).text);
    expect(
      codes(ITEMIZED_SHEET_NAMES.oj).every((c) => c.startsWith('GN-')),
    ).toBe(true);
    expect(
      codes(ITEMIZED_SHEET_NAMES.ojLabor).every((c) => c.startsWith('GN-')),
    ).toBe(true);
    expect(
      codes(ITEMIZED_SHEET_NAMES.main).every((c) => c.startsWith('GR-')),
    ).toBe(true);
    expect(
      codes(ITEMIZED_SHEET_NAMES.mainLabor).every((c) => c.startsWith('GR-')),
    ).toBe(true);
  });

  it('không tạo sheet rỗng, riêng sheet MAIN gốc luôn có', () => {
    const wb = new ExcelJS.Workbook();
    buildItemizedSheets(wb, [mainCase], new Map([['m1', [line('Lần')]]]));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      ITEMIZED_SHEET_NAMES.main,
    ]);

    const wb2 = new ExcelJS.Workbook();
    buildItemizedSheets(wb2, [], new Map());
    expect(wb2.worksheets.map((w) => w.name)).toEqual([
      ITEMIZED_SHEET_NAMES.main,
    ]);
  });

  it('itemizedSheetKeyOf: thiếu accountKey là MAIN, ĐVT rỗng không phải công', () => {
    expect(itemizedSheetKeyOf({}, line('Công'))).toBe('mainLabor');
    expect(itemizedSheetKeyOf({ accountKey: 'oj' }, line(''))).toBe('oj');
    expect(itemizedSheetKeyOf(ojCase, { DonViTinhText: 'Công' })).toBe(
      'ojLabor',
    );
  });
});
