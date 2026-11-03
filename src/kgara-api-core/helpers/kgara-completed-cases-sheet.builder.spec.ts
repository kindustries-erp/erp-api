import * as ExcelJS from 'exceljs';
import {
  buildSheet1CompletedCases,
  resolveCompletedCasesColumns,
  SHEET1_NAME,
} from './kgara-completed-cases-sheet.builder';
import { COMPLETED_CASES_COLUMNS } from './kgara-excel-style.helper';

const sampleCase = {
  id: 'case-1',
  soChungTu: 'PDV-001',
  bienSoXe: '51A-99999',
  khachHangCode: 'KH-1',
  khachHangName: 'Nguyễn Văn A',
  tenTinhTrangDichVu: 'Hoàn tất',
  ngayTiepNhan: new Date('2026-03-01'),
  ngayHoanThanhCongViec: new Date('2026-03-05'),
  tienCoThue: 20000000,
  tienDaThanhToan: 15000000,
  doanhThu: 20000000,
  chiPhi: 12000000,
  branchExternalId: 'CN-1',
};

const headersOf = (sheet: ExcelJS.Worksheet): string[] =>
  (sheet.getRow(4).values as unknown[]).slice(1).map(String);

const build = (selectedColumns?: string[]) => {
  const workbook = new ExcelJS.Workbook();
  const summary = buildSheet1CompletedCases(
    workbook,
    [sampleCase],
    {},
    {},
    {},
    undefined,
    {},
    selectedColumns,
  );
  const sheet = workbook.getWorksheet(SHEET1_NAME) as ExcelJS.Worksheet;
  return { sheet, summary };
};

describe('resolveCompletedCasesColumns', () => {
  it('trả về toàn bộ cột khi không có lựa chọn hoặc key không khớp', () => {
    expect(resolveCompletedCasesColumns()).toBe(COMPLETED_CASES_COLUMNS);
    expect(resolveCompletedCasesColumns([])).toBe(COMPLETED_CASES_COLUMNS);
    expect(resolveCompletedCasesColumns(['khong-ton-tai'])).toBe(
      COMPLETED_CASES_COLUMNS,
    );
  });

  it('giữ thứ tự cột gốc khi lọc theo lựa chọn', () => {
    const columns = resolveCompletedCasesColumns(['doanhThu', 'soChungTu']);
    expect(columns.map((c) => c.key)).toEqual(['soChungTu', 'doanhThu']);
  });
});

describe('buildSheet1CompletedCases với selectedColumns', () => {
  it('xuất đúng cột đã chọn ở header và trả về danh sách cột thực tế', () => {
    const { sheet, summary } = build(['soChungTu', 'doanhThu', 'chiPhi']);

    const expectedHeaders = ['soChungTu', 'doanhThu', 'chiPhi'].map(
      (key) => COMPLETED_CASES_COLUMNS.find((c) => c.key === key)?.header,
    );
    expect(headersOf(sheet)).toEqual(expectedHeaders);
    expect(summary.columns.map((c) => c.key)).toEqual([
      'soChungTu',
      'doanhThu',
      'chiPhi',
    ]);
  });

  it('giữ nguyên toàn bộ cột khi không truyền lựa chọn', () => {
    const { sheet, summary } = build();

    expect(sheet.columnCount).toBe(COMPLETED_CASES_COLUMNS.length);
    expect(summary.columns).toBe(COMPLETED_CASES_COLUMNS);
  });

  it('tính lợi nhuận bằng công thức khi đủ cột nguồn', () => {
    const { sheet } = build(['doanhThu', 'chiPhi', 'loiNhuan']);
    const profitCell = sheet.getRow(5).getCell(3).value as {
      formula: string;
      result: number;
    };

    expect(profitCell.formula).toBe('A5-B5');
    expect(profitCell.result).toBe(8000000);
  });

  it('chỉ giữ giá trị khi thiếu cột nguồn của công thức', () => {
    const { sheet } = build(['soChungTu', 'conPhaiThu']);
    const receivableCell = sheet.getRow(5).getCell(2).value;

    expect(typeof receivableCell).toBe('number');
  });
});

describe('cột tùy chọn của Sheet 1', () => {
  const optionalCase = {
    ...sampleCase,
    createdAt: new Date('2026-03-02T08:30:00'),
    updatedAt: new Date('2026-03-06T17:45:00'),
    dataAsOf: null,
    excludeFromReports: true,
    excludeFromDebt: false,
    rawData: { TienThueKH: 1800000 },
  };

  const buildOptional = (selectedColumns?: string[]) => {
    const workbook = new ExcelJS.Workbook();
    const summary = buildSheet1CompletedCases(
      workbook,
      [optionalCase],
      {},
      {},
      {},
      undefined,
      {},
      selectedColumns,
    );
    return {
      sheet: workbook.getWorksheet(SHEET1_NAME) as ExcelJS.Worksheet,
      summary,
    };
  };

  it('không chọn thì chỉ có 30 cột mặc định, Thuế GTGT đứng ngay trái Doanh thu', () => {
    const keys = resolveCompletedCasesColumns().map((c) => c.key);
    expect(keys).toHaveLength(30);
    expect(keys.indexOf('vatAmount')).toBe(keys.indexOf('doanhThu') - 1);
    expect(keys).not.toContain('exclusionRules');
  });

  it('chọn cột tùy chọn thì xuất đúng giá trị và cộng tổng thuế GTGT', () => {
    const { sheet, summary } = buildOptional([
      'vatAmount',
      'exclusionRules',
      'createdAt',
    ]);

    expect(summary.columns.map((c) => c.key)).toEqual([
      'vatAmount',
      'exclusionRules',
      'createdAt',
    ]);
    expect(sheet.getRow(5).getCell(1).value).toBe(1800000);
    expect(sheet.getRow(5).getCell(2).value).toBe('Loại khỏi báo cáo');
    const created = sheet.getRow(5).getCell(3);
    expect(created.value).toEqual(new Date(Date.UTC(2026, 2, 2, 8, 30)));
    expect(created.numFmt).toBe('dd/mm/yyyy hh:mm');
    expect(summary.sums.vatAmount).toBe(1800000);
  });

  it('phiếu không có TienThue vẫn ra thuế GTGT theo chênh lệch 8% của dòng dịch vụ', () => {
    const workbook = new ExcelJS.Workbook();
    const serviceLinesMap = new Map([
      ['hd-gr-0046', [{ tienCoThue: 1950000, tienChuaThue: 1950000 }]],
    ]);
    const summary = buildSheet1CompletedCases(
      workbook,
      [
        {
          ...sampleCase,
          hdPhieuDichVuId: 'hd-gr-0046',
          tienCoThue: 2106000,
          rawData: {},
        },
      ],
      {},
      {},
      {},
      serviceLinesMap,
      {},
      ['vatAmount'],
    );
    const sheet = workbook.getWorksheet(SHEET1_NAME) as ExcelJS.Worksheet;

    expect(sheet.getRow(5).getCell(1).value).toBe(156000);
    expect(summary.sums.vatAmount).toBe(156000);
  });

  it('VAT hóa đơn liên kết (map) ưu tiên hơn nguồn dự phòng từ dòng dịch vụ', () => {
    const workbook = new ExcelJS.Workbook();
    const serviceLinesMap = new Map([
      ['hd-gr-0046', [{ tienCoThue: 1950000, tienChuaThue: 1950000 }]],
    ]);
    const summary = buildSheet1CompletedCases(
      workbook,
      [
        {
          ...sampleCase,
          hdPhieuDichVuId: 'hd-gr-0046',
          tienCoThue: 2106000,
          rawData: {},
        },
      ],
      {},
      {},
      {},
      serviceLinesMap,
      {},
      ['vatAmount'],
      { [sampleCase.id]: 156000 },
    );
    const sheet = workbook.getWorksheet(SHEET1_NAME) as ExcelJS.Worksheet;

    expect(sheet.getRow(5).getCell(1).value).toBe(156000);
    expect(summary.sums.vatAmount).toBe(156000);
  });

  it('dataAsOf rỗng để ô trống', () => {
    const { sheet } = buildOptional(['dataAsOf']);
    expect(sheet.getRow(5).getCell(1).value).toBeNull();
  });
});

describe('Sheet 1: cột ngày thật và màu nhóm', () => {
  const build = () => {
    const workbook = new ExcelJS.Workbook();
    const summary = buildSheet1CompletedCases(
      workbook,
      [
        {
          ...sampleCase,
          ngayTiepNhan: new Date(2026, 2, 1),
          ngayHoanThanhCongViec: null,
        },
      ],
      {},
      {},
      {},
      undefined,
      {},
    );
    const sheet = workbook.getWorksheet(SHEET1_NAME) as ExcelJS.Worksheet;
    const colOf = (key: string) =>
      summary.columns.findIndex((c) => c.key === key) + 1;
    const argbOf = (cell: ExcelJS.Cell) =>
      (cell.fill as ExcelJS.FillPattern).fgColor?.argb;
    return { sheet, colOf, argbOf };
  };

  it('ngày tiếp nhận là kiểu ngày thật với định dạng dd/mm/yyyy', () => {
    const { sheet, colOf } = build();
    const cell = sheet.getRow(5).getCell(colOf('ngayTiepNhan'));
    expect(cell.value).toBeInstanceOf(Date);
    expect(cell.numFmt).toBe('dd/mm/yyyy');
    expect((cell.value as Date).getUTCDate()).toBe(1);
    expect((cell.value as Date).getUTCMonth()).toBe(2);
  });

  it('ngày hoàn thành trống để ô trống', () => {
    const { sheet, colOf } = build();
    expect(
      sheet.getRow(5).getCell(colOf('ngayHoanThanhCongViec')).value,
    ).toBeNull();
  });

  it('header theo nhóm: Phải thu lục, Phải trả hồng, Doanh thu tím', () => {
    const { sheet, colOf, argbOf } = build();
    expect(argbOf(sheet.getRow(4).getCell(colOf('phaiThu')))).toBe('FF047857');
    expect(argbOf(sheet.getRow(4).getCell(colOf('chiPhiNhanCong')))).toBe(
      'FFBE123C',
    );
    expect(argbOf(sheet.getRow(4).getCell(colOf('doanhThu')))).toBe('FF6D28D9');
  });

  it('ghi chú giữ nền kem, không bị ghi đè bởi màu nhóm Phải thu', () => {
    const { sheet, colOf, argbOf } = build();
    expect(argbOf(sheet.getRow(5).getCell(colOf('ghiChuThu')))).toBe(
      'FFFFFBEB',
    );
  });
});
