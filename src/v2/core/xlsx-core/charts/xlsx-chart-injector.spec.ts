import { DOMParser } from '@xmldom/xmldom';
import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { injectCharts } from './xlsx-chart-injector';
import type { XlsxChartSpec } from './xlsx-chart.types';

const SHEET = "Dash O'Q3";

const baseSpec = (overrides: Partial<XlsxChartSpec> = {}): XlsxChartSpec => ({
  type: 'column',
  title: 'Tiêu đề & <đặc biệt>',
  anchor: { fromCol: 0, fromRow: 10, toCol: 6, toRow: 25 },
  categoriesRef: '$A$2:$A$4',
  categories: ['A', 'B', 'C'],
  series: [
    {
      name: 'Doanh thu',
      valuesRef: '$B$2:$B$4',
      values: [1, 2, 3],
      color: '059669',
    },
  ],
  ...overrides,
});

async function buildWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const dash = wb.addWorksheet(SHEET);
  dash.addRows([
    ['Nhóm', 'Doanh thu', 'Chi phí'],
    ['A', 1, 2],
    ['B', 2, 3],
    ['C', 3, 4],
  ]);
  dash.mergeCells('E1:G1');
  wb.addWorksheet('Chi tiết').addRow([1]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const parse = (xml: string) => {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (_level, msg) => errors.push(String(msg)),
  }).parseFromString(xml, 'text/xml');
  return { doc, errors };
};

describe('injectCharts', () => {
  it('không có chart thì trả nguyên file', async () => {
    const input = await buildWorkbook();
    const output = await injectCharts(input, SHEET, []);
    expect(output.equals(input)).toBe(true);
  });

  it('thêm đủ part, quan hệ và content type; file vẫn mở được bằng exceljs', async () => {
    const input = await buildWorkbook();
    const output = await injectCharts(input, SHEET, [
      baseSpec(),
      baseSpec({ type: 'line', title: 'Đường' }),
    ]);

    const zip = await JSZip.loadAsync(output);
    expect(zip.file('xl/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('xl/charts/chart2.xml')).not.toBeNull();
    expect(zip.file('xl/drawings/drawing1.xml')).not.toBeNull();

    const drawingRels = await zip
      .file('xl/drawings/_rels/drawing1.xml.rels')!
      .async('string');
    expect(drawingRels).toContain('Target="../charts/chart1.xml"');
    expect(drawingRels).toContain('Target="../charts/chart2.xml"');

    const sheetRels = await zip
      .file('xl/worksheets/_rels/sheet1.xml.rels')!
      .async('string');
    expect(sheetRels).toContain('Target="../drawings/drawing1.xml"');

    const types = await zip.file('[Content_Types].xml')!.async('string');
    expect(types).toContain('PartName="/xl/drawings/drawing1.xml"');
    expect(types).toContain('PartName="/xl/charts/chart1.xml"');
    expect(types).toContain('PartName="/xl/charts/chart2.xml"');

    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(output as any);
    expect(reopened.worksheets.map((w) => w.name)).toEqual([SHEET, 'Chi tiết']);
    expect(reopened.getWorksheet(SHEET)!.getCell('B2').value).toBe(1);
  });

  it('đặt <drawing> sau pageSetup và rId khớp quan hệ sheet', async () => {
    const output = await injectCharts(await buildWorkbook(), SHEET, [
      baseSpec(),
    ]);
    const zip = await JSZip.loadAsync(output);
    const sheetXml = await zip
      .file('xl/worksheets/sheet1.xml')!
      .async('string');

    expect(sheetXml.indexOf('<drawing r:id=')).toBeGreaterThan(
      sheetXml.indexOf('<pageSetup'),
    );
    expect(sheetXml.indexOf('<drawing r:id=')).toBeLessThan(
      sheetXml.lastIndexOf('</worksheet>'),
    );
    const rId = /<drawing r:id="([^"]+)"/.exec(sheetXml)![1];
    const rels = await zip
      .file('xl/worksheets/_rels/sheet1.xml.rels')!
      .async('string');
    expect(rels).toContain(`Id="${rId}"`);
    expect(parse(sheetXml).errors).toEqual([]);
  });

  it('chỉ chèn vào đúng sheet được chọn', async () => {
    const output = await injectCharts(await buildWorkbook(), 'Chi tiết', [
      baseSpec(),
    ]);
    const zip = await JSZip.loadAsync(output);
    expect(zip.file('xl/worksheets/_rels/sheet2.xml.rels')).not.toBeNull();
    expect(zip.file('xl/worksheets/_rels/sheet1.xml.rels')).toBeNull();
    const sheet1 = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet1).not.toContain('<drawing');
  });

  it('ném lỗi rõ ràng khi sheet không tồn tại', async () => {
    await expect(
      injectCharts(await buildWorkbook(), 'Không có', [baseSpec()]),
    ).rejects.toThrow("Không tìm thấy sheet 'Không có'");
  });

  describe.each([
    ['column', baseSpec()],
    ['bar', baseSpec({ type: 'bar' })],
    ['line', baseSpec({ type: 'line', dataLabels: true })],
    [
      'combo',
      baseSpec({
        type: 'combo',
        series: [
          {
            name: 'Doanh thu',
            valuesRef: '$B$2:$B$4',
            values: [1, 2, 3],
            color: '059669',
          },
          {
            name: 'Lợi nhuận',
            valuesRef: '$C$2:$C$4',
            values: [2, 3, 4],
            color: 'D97706',
            kind: 'line',
          },
        ],
      }),
    ],
    [
      'doughnut',
      baseSpec({
        type: 'doughnut',
        pointColors: ['059669', 'D97706', '475569'],
      }),
    ],
  ])('chart %s', (type, spec) => {
    it('sinh XML hợp lệ với tham chiếu ô có tên sheet được escape', async () => {
      const output = await injectCharts(await buildWorkbook(), SHEET, [spec]);
      const zip = await JSZip.loadAsync(output);
      const xml = await zip.file('xl/charts/chart1.xml')!.async('string');

      const { doc, errors } = parse(xml);
      expect(errors).toEqual([]);
      expect(doc.documentElement?.localName).toBe('chartSpace');

      expect(xml).toContain("<c:f>'Dash O''Q3'!$A$2:$A$4</c:f>");
      expect(xml).toContain("<c:f>'Dash O''Q3'!$B$2:$B$4</c:f>");
      expect(xml).toContain('Tiêu đề &amp; &lt;đặc biệt&gt;');
      expect(xml).toContain('<c:ptCount val="3"/>');

      const expectedTag = {
        column: '<c:barChart>',
        bar: '<c:barChart>',
        line: '<c:lineChart>',
        combo: '<c:lineChart>',
        doughnut: '<c:doughnutChart>',
      }[type as string]!;
      expect(xml).toContain(expectedTag);
      if (type === 'bar') expect(xml).toContain('<c:barDir val="bar"/>');
      if (type === 'combo') expect(xml).toContain('<c:barChart>');
      if (type === 'doughnut') {
        expect(xml).not.toContain('<c:catAx>');
        expect(xml).toContain('<c:showPercent val="1"/>');
        expect((xml.match(/<c:dPt>/g) ?? []).length).toBe(3);
      } else {
        expect(xml).toContain('<c:catAx>');
        expect(xml).toContain('<c:valAx>');
      }
    });
  });

  it('reverseCategories đảo trục danh mục và đưa trục giá trị xuống đáy', async () => {
    const output = await injectCharts(await buildWorkbook(), SHEET, [
      baseSpec({ type: 'bar', reverseCategories: true }),
      baseSpec({ type: 'bar' }),
    ]);
    const zip = await JSZip.loadAsync(output);
    const reversed = await zip.file('xl/charts/chart1.xml')!.async('string');
    const normal = await zip.file('xl/charts/chart2.xml')!.async('string');

    expect(reversed).toContain('<c:orientation val="maxMin"/>');
    expect(reversed).toContain('<c:crosses val="max"/>');
    expect(normal).not.toContain('maxMin');
  });

  it('loại ký tự điều khiển không hợp lệ khỏi XML (tiêu đề/tên series)', async () => {
    const output = await injectCharts(await buildWorkbook(), SHEET, [
      baseSpec({ title: 'A\u0001B\tC' }),
    ]);
    const zip = await JSZip.loadAsync(output);
    const xml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(xml).toContain('AB\tC');
    expect(parse(xml).errors).toEqual([]);
  });

  it('drawing có anchor đúng và mỗi chart một rId riêng', async () => {
    const output = await injectCharts(await buildWorkbook(), SHEET, [
      baseSpec(),
      baseSpec({ anchor: { fromCol: 7, fromRow: 10, toCol: 13, toRow: 25 } }),
    ]);
    const zip = await JSZip.loadAsync(output);
    const drawing = await zip.file('xl/drawings/drawing1.xml')!.async('string');

    expect(parse(drawing).errors).toEqual([]);
    expect(drawing).toContain('<xdr:col>7</xdr:col>');
    expect(drawing).toContain('r:id="rId1"');
    expect(drawing).toContain('r:id="rId2"');
  });

  it('không ghi đè part có sẵn khi chèn lần thứ hai vào sheet khác', async () => {
    const once = await injectCharts(await buildWorkbook(), SHEET, [baseSpec()]);
    const twice = await injectCharts(once, 'Chi tiết', [
      baseSpec({ title: 'Thứ hai' }),
    ]);
    const zip = await JSZip.loadAsync(twice);

    expect(zip.file('xl/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('xl/charts/chart2.xml')).not.toBeNull();
    expect(zip.file('xl/drawings/drawing2.xml')).not.toBeNull();
    const chart2 = await zip.file('xl/charts/chart2.xml')!.async('string');
    expect(chart2).toContain('Thứ hai');
  });
});
