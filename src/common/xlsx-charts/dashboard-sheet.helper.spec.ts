import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_CHART_ROWS,
  DASHBOARD_COLUMNS,
  absRef,
  chartAnchor,
  columnLetter,
  createDashboardSheet,
  rowAfterCharts,
  writeDashboardHeader,
  writeDataTable,
  writeKpiCards,
} from './dashboard-sheet.helper';

describe('dashboard-sheet.helper', () => {
  it('columnLetter / absRef', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(26)).toBe('Z');
    expect(columnLetter(27)).toBe('AA');
    expect(absRef(2, 20, 29)).toBe('$B$20:$B$29');
  });

  it('Dashboard là sheet đầu, ẩn lưới, 16 cột', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    wb.addWorksheet('Chi tiết');

    expect(wb.worksheets[0].name).toBe('Dashboard');
    expect(dash.views[0]).toMatchObject({ showGridLines: false });
    expect(dash.getColumn(DASHBOARD_COLUMNS).width).toBeGreaterThan(0);
  });

  it('header ghi tiêu đề + dòng phụ và trả về dòng trống kế tiếp', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const next = writeDashboardHeader(dash, 'Báo cáo', [
      'Kỳ: 01/07 - 31/07',
      'Chi nhánh: CN1',
    ]);

    expect(dash.getCell('A1').value).toBe('Báo cáo');
    expect(dash.getCell('A2').value).toBe('Kỳ: 01/07 - 31/07');
    expect(dash.getCell('A3').value).toBe('Chi nhánh: CN1');
    expect(next).toBe(5);
  });

  it('KPI: công thức giữ nguyên kèm result, số thường, 4 thẻ/hàng', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const next = writeKpiCards(dash, 5, [
      {
        label: 'Tổng',
        value: { formula: "SUM('Chi tiết'!F5:F9)", result: 700 },
      },
      { label: 'Xe', value: 12 },
      { label: 'C', value: 1 },
      { label: 'D', value: 2 },
      { label: 'E', value: 3, numFmt: '0.0%' },
    ]);

    expect(dash.getCell('A5').value).toBe('Tổng');
    expect(dash.getCell('A6').value).toEqual({
      formula: "SUM('Chi tiết'!F5:F9)",
      result: 700,
    });
    expect(dash.getCell('E6').value).toBe(12);
    expect(dash.getCell('M6').value).toBe(2);
    // thẻ thứ 5 xuống hàng kế
    expect(dash.getCell('A8').value).toBe('E');
    expect(dash.getCell('A9').numFmt).toBe('0.0%');
    expect(next).toBe(11);
  });

  it('chartAnchor: 2 chart/hàng, hàng sau cách đúng số dòng, full width', () => {
    const left = chartAnchor(11, 0);
    const right = chartAnchor(11, 1);
    const below = chartAnchor(11, 2);

    expect(left).toEqual({
      fromCol: 0,
      fromRow: 10,
      toCol: 8,
      toRow: 10 + DASHBOARD_CHART_ROWS,
    });
    expect(right).toMatchObject({ fromCol: 8, toCol: 16, fromRow: 10 });
    expect(below.fromRow).toBe(10 + DASHBOARD_CHART_ROWS + 1);
    expect(chartAnchor(11, 0, { fullWidth: true })).toMatchObject({
      fromCol: 0,
      toCol: 16,
    });
    // không chồng lấn dữ liệu bên dưới
    expect(rowAfterCharts(11, 2)).toBeGreaterThan(below.toRow);
  });

  it('writeDataTable: ghi dữ liệu và trả tham chiếu cột đúng vùng dữ liệu', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const refs = writeDataTable(dash, {
      startRow: 40,
      startCol: 2,
      title: 'Top 3',
      headers: ['Tên', 'Còn nợ'],
      rows: [
        ['A', 300],
        ['B', 200],
        ['C', 100],
      ],
      numFmts: [undefined, '#,##0'],
    });

    expect(dash.getCell('B40').value).toBe('Top 3');
    expect(dash.getCell('B41').value).toBe('Tên');
    expect(dash.getCell('B42').value).toBe('A');
    expect(dash.getCell('C44').value).toBe(100);
    expect(dash.getCell('C42').numFmt).toBe('#,##0');
    expect(refs.firstDataRow).toBe(42);
    expect(refs.lastDataRow).toBe(44);
    expect(refs.ref(0)).toBe('$B$42:$B$44');
    expect(refs.ref(1)).toBe('$C$42:$C$44');
    expect(refs.nextRow).toBe(46);
  });

  it('writeDataTable với 0 dòng vẫn trả vùng 1 dòng hợp lệ', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const refs = writeDataTable(dash, {
      startRow: 1,
      startCol: 1,
      title: 'Trống',
      headers: ['A'],
      rows: [],
    });
    expect(refs.firstDataRow).toBe(3);
    expect(refs.lastDataRow).toBe(3);
  });
});
