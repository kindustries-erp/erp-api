import * as ExcelJS from 'exceljs';

import {
  DASHBOARD_CHART_ROWS,
  DASHBOARD_COLUMNS,
  absRef,
  chartAnchor,
  chartAnchorRow,
  columnLetter,
  createDashboardSheet,
  rowAfterCharts,
  setDashboardPrintArea,
  writeAlertCards,
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

  it('KPI: có tiêu đề nhóm thì thẻ xuống một dòng, không có thì giữ nguyên vị trí', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const next = writeKpiCards(dash, 5, [{ label: 'Thu', value: 1 }], {
      title: 'Thu chi trong kỳ',
    });

    expect(dash.getCell('A5').value).toBe('Thu chi trong kỳ');
    expect(dash.getCell('A6').value).toBe('Thu');
    expect(dash.getCell('A7').value).toBe(1);
    expect(next).toBe(9);

    const plain = wb.addWorksheet('Plain');
    expect(writeKpiCards(plain, 5, [{ label: 'Thu', value: 1 }])).toBe(8);
    expect(plain.getCell('A5').value).toBe('Thu');
  });

  it('sheet tuỳ chọn số cột: 18 cột, độ rộng và vùng in theo cột R', () => {
    const wb = new ExcelJS.Workbook();
    const sheet = createDashboardSheet(wb, 'Báo cáo', 18);
    writeDashboardHeader(sheet, 'Tiêu đề', ['dòng phụ'], 18);
    setDashboardPrintArea(sheet, 30, 18);
    expect(sheet.getColumn(18).width).toBe(13);
    expect(sheet.pageSetup.printArea).toBe('A1:R30');
  });

  it('KPI: theme nhóm đổi màu tiêu đề, nền dải, nền thẻ, nhãn và giá trị; không theme thì giữ màu cũ', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Báo cáo', 18);
    const theme = {
      titleColor: 'FF065F46',
      titleFill: 'FFD1FAE5',
      titleSize: 13,
      cardFill: 'FFECFDF5',
      border: 'FFA7F3D0',
      labelColor: 'FF047857',
      valueColor: 'FF065F46',
    };
    writeKpiCards(dash, 5, [{ label: 'Thu', value: 1 }], {
      title: 'Thu chi',
      theme,
      cardCols: 3,
      cardsPerRow: 2,
    });
    expect(dash.getCell('A5').font?.size).toBe(13);
    expect(dash.getCell('A5').font?.color?.argb).toBe('FF065F46');
    expect(dash.getCell('A5').fill).toMatchObject({
      fgColor: { argb: 'FFD1FAE5' },
    });
    expect(dash.getCell('A6').font?.color?.argb).toBe('FF047857');
    expect(dash.getCell('A7').font?.color?.argb).toBe('FF065F46');
    expect(dash.getCell('A7').fill).toMatchObject({
      fgColor: { argb: 'FFECFDF5' },
    });

    const plain = wb.addWorksheet('Plain');
    writeKpiCards(plain, 5, [{ label: 'Thu', value: 1 }], { title: 'Thu' });
    expect(plain.getCell('A5').font?.size).toBe(11);
    expect(plain.getCell('A6').fill).toMatchObject({
      fgColor: { argb: 'FFF8FAFC' },
    });
  });

  it('KPI: đặt thẻ theo cột (startCol, cardCols, cardsPerRow), tiêu đề chỉ gộp đúng dải cột', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    writeKpiCards(
      dash,
      5,
      [
        { label: 'Phải thu', value: 1, note: 'x' },
        { label: 'Phải chi', value: 2, note: 'y' },
      ],
      { title: 'Cột ba', startCol: 11, cardCols: 3, cardsPerRow: 1 },
    );

    expect(dash.getCell('K5').value).toBe('Cột ba');
    expect(dash.getCell('K6').value).toBe('Phải thu');
    expect(dash.getCell('K7').value).toBe(1);
    expect(dash.getCell('K8').value).toBe('x');
    // thẻ thứ hai xuống hàng dưới, vẫn ở cột K
    expect(dash.getCell('K10').value).toBe('Phải chi');
    expect(dash.getCell('A6').value).toBeNull();
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

  it('writeAlertCards: có tiêu đề nhóm, 4 thẻ/hàng, mỗi thẻ 3 dòng, trả dòng trống kế tiếp', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const card = (label: string, value: string | number, note?: string) => ({
      label,
      value,
      note,
      fill: 'FFFEE2E2',
      font: 'FFBE123C',
    });

    const next = writeAlertCards(
      dash,
      6,
      [
        card('MỨC CẢNH BÁO', 'CAO', 'Quá hạn 77,6%'),
        card('NỢ >90 NGÀY', 12000000, '1 đối tượng'),
        card('NỢ 61-90 NGÀY', 0),
        card('NỢ 31-60 NGÀY', 500),
        card('THẺ HÀNG HAI', 1),
      ],
      { title: 'PHẢI THU' },
    );

    expect(dash.getCell(6, 1).value).toBe('PHẢI THU');
    // thẻ 1 ở cột A, thẻ 2 ở cột E (mỗi thẻ rộng 4 cột)
    expect(dash.getCell(7, 1).value).toBe('MỨC CẢNH BÁO');
    expect(dash.getCell(8, 1).value).toBe('CAO');
    expect(dash.getCell(9, 1).value).toBe('Quá hạn 77,6%');
    expect(dash.getCell(8, 5).value).toBe(12000000);
    expect(dash.getCell(8, 5).numFmt).toBe('#,##0');
    expect(dash.getCell(8, 1).numFmt).not.toBe('#,##0');
    // hàng thẻ thứ hai bắt đầu sau 3 dòng + 1 dòng đệm
    expect(dash.getCell(11, 1).value).toBe('THẺ HÀNG HAI');
    expect(next).toBe(15);
    expect((dash.getCell(8, 1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe(
      'FFFEE2E2',
    );
    expect(dash.getCell(8, 1).font?.color?.argb).toBe('FFBE123C');
  });

  it('writeAlertCards: không có tiêu đề thì thẻ bắt đầu ngay dòng startRow, dòng đệm nhỏ, chiều cao tùy chỉnh', () => {
    const wb = new ExcelJS.Workbook();
    const dash = createDashboardSheet(wb, 'Dashboard');
    const card = {
      label: 'NHÃN',
      value: 1,
      fill: 'FFF1F5F9',
      font: 'FF64748B',
    };

    const next = writeAlertCards(dash, 5, [card, card, card, card], {
      heights: [14, 22, 24],
    });

    expect(dash.getCell(5, 1).value).toBe('NHÃN');
    expect(dash.getRow(5).height).toBe(14);
    expect(dash.getRow(6).height).toBe(22);
    expect(dash.getRow(7).height).toBe(24);
    expect(dash.getRow(8).height).toBe(6);
    expect(next).toBe(9);
  });

  it('chartAnchorRow: chia đều 16 cột cho 3 chart một hàng, hàng kế cách chart + 1 dòng', () => {
    expect(chartAnchorRow(20, 0, 3, 14)).toEqual({
      fromCol: 0,
      fromRow: 19,
      toCol: 5,
      toRow: 33,
    });
    expect(chartAnchorRow(20, 1, 3, 14)).toMatchObject({
      fromCol: 5,
      toCol: 11,
    });
    expect(chartAnchorRow(20, 2, 3, 14)).toMatchObject({
      fromCol: 11,
      toCol: 16,
    });
    // slot 3 xuống hàng kế
    expect(chartAnchorRow(20, 3, 3, 14)).toMatchObject({
      fromCol: 0,
      fromRow: 34,
      toRow: 48,
    });
    // 2 chart một hàng: nửa trái, nửa phải
    expect(chartAnchorRow(1, 1, 2, 10)).toMatchObject({
      fromCol: 8,
      toCol: 16,
    });
  });
});
