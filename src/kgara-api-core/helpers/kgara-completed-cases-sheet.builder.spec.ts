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

  it('không chọn thì chỉ có 29 cột mặc định', () => {
    expect(resolveCompletedCasesColumns()).toHaveLength(29);
    expect(
      resolveCompletedCasesColumns().some((c) => c.key === 'vatAmount'),
    ).toBe(false);
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
    expect(sheet.getRow(5).getCell(3).value).toBe('02/03/2026 08:30');
    expect(summary.sums.vatAmount).toBe(1800000);
  });

  it('dataAsOf rỗng hiển thị dấu gạch', () => {
    const { sheet } = buildOptional(['dataAsOf']);
    expect(sheet.getRow(5).getCell(1).value).toBe('—');
  });
});
