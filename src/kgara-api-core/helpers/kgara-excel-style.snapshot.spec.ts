import * as ExcelJS from 'exceljs';
import * as helper from './kgara-excel-style.helper';

/**
 * Khóa hành vi của barrel kgara-excel-style.helper: danh sách export, hằng cột,
 * style áp lên workbook mẫu và tên file. Snapshot phải giữ nguyên khi tách file.
 */
function dumpSheet(sheet: ExcelJS.Worksheet) {
  const rows: unknown[] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNo) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNo) => {
      cells.push({
        colNo,
        value: cell.value,
        numFmt: cell.numFmt,
        font: cell.font,
        fill: cell.fill,
        border: cell.border,
        alignment: cell.alignment,
      });
    });
    rows.push({ rowNo, height: row.height, cells });
  });
  return {
    columns: (sheet.columns ?? []).map((c) => ({ key: c.key, width: c.width })),
    views: sheet.views,
    autoFilter: sheet.autoFilter,
    rows,
  };
}

describe('kgara-excel-style.helper (snapshot khóa hành vi)', () => {
  it('giữ nguyên danh sách export', () => {
    expect(Object.keys(helper).sort()).toMatchSnapshot();
  });

  it('giữ nguyên hằng cột và palette', () => {
    expect({
      borderThin: helper.borderThin,
      borderSummaryTopBottom: helper.borderSummaryTopBottom,
      COMPLETED_CASES_COLUMN_GROUPS: helper.COMPLETED_CASES_COLUMN_GROUPS,
      CASE_PNL_COLUMN_GROUPS: helper.CASE_PNL_COLUMN_GROUPS,
      COMPLETED_CASES_COLUMNS: helper.COMPLETED_CASES_COLUMNS,
      COMPLETED_CASES_OPTIONAL_COLUMNS: helper.COMPLETED_CASES_OPTIONAL_COLUMNS,
      COMPLETED_CASES_ALL_COLUMNS: helper.COMPLETED_CASES_ALL_COLUMNS,
      COMPLETED_CASES_EXPORT_COLUMN_KEYS:
        helper.COMPLETED_CASES_EXPORT_COLUMN_KEYS,
      CASE_PNL_COLUMNS: helper.CASE_PNL_COLUMNS,
      COMPLETED_CASE_SERVICES_COLUMNS: helper.COMPLETED_CASE_SERVICES_COLUMNS,
      CASE_SERVICES_EXPORT_COLUMNS: helper.CASE_SERVICES_EXPORT_COLUMNS,
    }).toMatchSnapshot();
  });

  it('giữ nguyên style workbook sau layout, nhóm cột, dự kiến và biên LN', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Snapshot');
    const columns = helper.COMPLETED_CASES_COLUMNS;

    helper.initSheetStructure(sheet, columns);
    sheet.addRow(columns.map((c, i) => (c.isSum ? (i + 1) * 1000 : c.key)));
    sheet.addRow(columns.map((c, i) => (c.isSum ? (i + 1) * 500 : c.key)));
    const sums = Object.fromEntries(
      columns.filter((c) => c.isSum).map((c, i) => [c.key, (i + 1) * 1500]),
    );
    helper.applyStandardExcelReportLayout(sheet, columns, 3, sums);
    helper.applyColumnGroupStyles(sheet, columns);
    helper.applyForecastColumnStyle(sheet, 2);

    [-0.1, 0.05, 0.15, 0.3, 0.5, 0.7, 0.9].forEach((m, i) => {
      helper.styleMarginCell(sheet.getRow(5).getCell(i + 1), m);
    });

    expect(dumpSheet(sheet)).toMatchSnapshot();
  });

  it('giữ nguyên layout với công thức tùy chỉnh và nhóm cột P&L', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Pnl');
    const columns = helper.CASE_PNL_COLUMNS;

    helper.initSheetStructure(sheet, columns);
    sheet.addRow(columns.map((c) => c.key));
    const firstSum = columns.find((c) => c.isSum)?.key ?? columns[0].key;
    helper.applyStandardExcelReportLayout(
      sheet,
      columns,
      2,
      { [firstSum]: 42 },
      {
        sumRow: { [firstSum]: 'SUM(A5:A9)' },
        subtotalRow: { [firstSum]: 'SUBTOTAL(9,A5:A9)' },
      },
    );
    helper.applyColumnGroupStyles(
      sheet,
      columns,
      5,
      helper.CASE_PNL_COLUMN_GROUPS,
    );

    expect(dumpSheet(sheet)).toMatchSnapshot();
  });

  it('giữ nguyên tên file và chữ cái cột', () => {
    const date = new Date(2026, 10, 27, 9, 5, 7);
    const cases: Array<[string | undefined, string | undefined]> = [
      [undefined, undefined],
      ['ALL', 'all'],
      ['KY_GUI_NOI_BO', 'completed'],
      ['SUA_CHUA_CHUNG', 'OPEN'],
      ['OJ', undefined],
      ['OJ_NGOAI', undefined],
      ['KHAC', undefined],
      ['lạ/x', 'đang làm'],
    ];
    expect({
      names: cases.map(([c, s]) =>
        helper.buildGarageCaseExportFileName(c, s, date),
      ),
      letters: [1, 26, 27, 52, 53, 702, 703].map(helper.getExcelColumnLetter),
    }).toMatchSnapshot();
  });
});
