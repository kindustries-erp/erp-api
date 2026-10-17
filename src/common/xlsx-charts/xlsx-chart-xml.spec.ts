import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import { buildChartXml } from './xlsx-chart-xml';
import { LABEL_MONEY_FMT } from './xlsx-chart.types';
import type { XlsxChartSpec } from './xlsx-chart.types';

const spec = (overrides: Partial<XlsxChartSpec> = {}): XlsxChartSpec => ({
  type: 'column',
  title: 'Báo cáo',
  anchor: { fromCol: 0, fromRow: 0, toCol: 8, toRow: 16 },
  categoriesRef: '$A$2:$A$3',
  categories: ['T1', 'T2'],
  series: [
    {
      name: 'Doanh thu',
      valuesRef: '$B$2:$B$3',
      values: [10, 20],
      color: '059669',
    },
    {
      name: 'Chi phí',
      valuesRef: '$C$2:$C$3',
      values: [4, 8],
      color: 'D97706',
    },
  ],
  ...overrides,
});

const parse = (xml: string) => {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (_level: string, msg: string) => errors.push(msg),
  } as any).parseFromString(xml, 'text/xml');
  expect(errors).toEqual([]);
  return doc;
};

describe('buildChartXml', () => {
  it('categoryLabelsLow: nhãn trục danh mục ở đáy (low), mặc định nextTo', () => {
    const low = buildChartXml(spec({ categoryLabelsLow: true }), 'Báo cáo');
    expect(low).toContain('<c:tickLblPos val="low"/>');
    const normal = buildChartXml(spec(), 'Báo cáo');
    expect(normal).not.toContain('<c:tickLblPos val="low"/>');
  });

  it('series ẩn không tô màu, không nhãn; showLegend:false bỏ chú thích', () => {
    const xml = buildChartXml(
      spec({
        stacked: true,
        dataLabels: true,
        showLegend: false,
        series: [
          {
            name: 'Nền',
            valuesRef: '$B$2:$B$3',
            values: [0, 5],
            color: '000000',
            hidden: true,
          },
          {
            name: 'Doanh thu',
            valuesRef: '$C$2:$C$3',
            values: [10, 5],
            color: '059669',
          },
        ],
      }),
      'Dashboard',
    );
    const doc = parse(xml);
    const sers = Array.from(doc.getElementsByTagName('c:ser'));
    const hidden = sers[0];
    expect(hidden.getElementsByTagName('a:noFill').length).toBeGreaterThan(0);
    expect(hidden.getElementsByTagName('c:dLbls').length).toBe(0);
    expect(sers[1].getElementsByTagName('c:dLbls').length).toBe(1);
    expect(xml).not.toContain('<c:legend>');
  });

  it('compact: không tiêu đề, không chú thích, hai trục ẩn, không lưới, đường không marker', () => {
    const xml = buildChartXml(
      spec({
        compact: true,
        type: 'line',
        series: [
          {
            name: 'Phải thu',
            valuesRef: '$B$2:$B$3',
            values: [10, 20],
            color: '059669',
          },
        ],
      }),
      'Dashboard',
    );
    const doc = parse(xml);
    expect(xml).not.toContain('<c:title>');
    expect(xml).not.toContain('<c:legend>');
    expect(xml).not.toContain('<c:majorGridlines>');
    expect(xml).toContain('<c:autoTitleDeleted val="1"/>');
    expect(xml.match(/<c:delete val="1"\/>/g)).toHaveLength(2);
    expect(xml).toContain('<c:symbol val="none"/>');
    expect(doc.getElementsByTagName('c:lineChart').length).toBe(1);
  });

  it('không compact (mặc định): vẫn có tiêu đề, lưới và trục hiện', () => {
    const xml = buildChartXml(spec(), 'Dashboard');
    expect(xml).toContain('<c:title>');
    expect(xml).toContain('<c:majorGridlines>');
    expect(xml).toContain('<c:autoTitleDeleted val="0"/>');
    expect(xml).not.toContain('<c:delete val="1"/>');
  });

  it('mặc định là cột ghép, không có overlap và không có trục phụ', () => {
    const xml = buildChartXml(spec(), 'Dash');
    parse(xml);
    expect(xml).toContain('<c:grouping val="clustered"/>');
    expect(xml).not.toContain('<c:overlap');
    expect(xml).not.toContain('50040');
  });

  it('stacked: cột chồng với overlap 100, đặt trước các axId', () => {
    const xml = buildChartXml(spec({ stacked: true }), 'Dash');
    parse(xml);
    expect(xml).toContain('<c:grouping val="stacked"/>');
    expect(xml).not.toContain('<c:grouping val="clustered"/>');
    expect(xml).toMatch(
      /<c:gapWidth val="80"\/><c:overlap val="100"\/><c:axId/,
    );
  });

  it('combo không khai báo trục phụ: đường dùng chung trục chính như trước', () => {
    const xml = buildChartXml(
      spec({
        type: 'combo',
        series: [
          ...spec().series,
          {
            name: '%',
            valuesRef: '$D$2:$D$3',
            values: [0.4, 0.5],
            color: 'E11D48',
            kind: 'line',
          },
        ],
      }),
      'Dash',
    );
    parse(xml);
    expect(xml.match(/<c:lineChart>/g)).toHaveLength(1);
    expect(xml).not.toContain('50030');
    expect(xml).not.toContain('<c:axPos val="r"/>');
  });

  it('series đường secondaryAxis: lineChart riêng trên trục phụ bên phải với định dạng %', () => {
    const xml = buildChartXml(
      spec({
        type: 'combo',
        series: [
          ...spec().series,
          {
            name: '% lợi nhuận gộp',
            valuesRef: '$D$2:$D$3',
            values: [0.4, 0.5],
            color: 'E11D48',
            kind: 'line',
            secondaryAxis: true,
          },
        ],
      }),
      'Dash',
    );
    const doc = parse(xml);

    expect(doc.getElementsByTagName('c:barChart')).toHaveLength(1);
    const lineCharts = doc.getElementsByTagName('c:lineChart');
    expect(lineCharts).toHaveLength(1);
    expect(new XMLSerializer().serializeToString(lineCharts[0])).toContain(
      '<c:axId val="50030"/><c:axId val="50040"/>',
    );

    // 2 trục chính + 2 trục phụ; trục giá trị phụ nằm bên phải, cắt ở cuối trục danh mục
    expect(doc.getElementsByTagName('c:valAx')).toHaveLength(2);
    expect(doc.getElementsByTagName('c:catAx')).toHaveLength(2);
    expect(xml).toContain('<c:axPos val="r"/><c:numFmt formatCode="0.0%"');
    expect(xml).toContain('<c:crosses val="max"/>');
    expect(xml).toContain('<c:delete val="1"/>');
  });

  it('secondaryNumFmt tùy chỉnh được áp cho trục phụ và numCache của series phụ', () => {
    const xml = buildChartXml(
      spec({
        type: 'combo',
        secondaryNumFmt: '0%',
        series: [
          ...spec().series,
          {
            name: '%',
            valuesRef: '$D$2:$D$3',
            values: [0.4],
            color: 'E11D48',
            kind: 'line',
            secondaryAxis: true,
          },
        ],
      }),
      'Dash',
    );
    expect(xml).toContain('<c:axPos val="r"/><c:numFmt formatCode="0%"');
    expect(xml).toContain('<c:formatCode>0%</c:formatCode>');
  });

  describe('nhãn giá trị', () => {
    it('không bật thì không có dLbls (giữ nguyên chart cũ)', () => {
      expect(buildChartXml(spec(), 'Dash')).not.toContain('<c:dLbls>');
    });

    it('cột ghép: nhãn ngoài đầu cột với định dạng và cỡ chữ riêng', () => {
      const xml = buildChartXml(
        spec({
          dataLabels: true,
          labelNumFmt: LABEL_MONEY_FMT,
          labelFontSize: 700,
        }),
        'Dash',
      );
      parse(xml);
      expect(xml.match(/<c:dLblPos val="outEnd"\/>/g)).toHaveLength(2);
      expect(xml).toContain('sz="700"');
      expect(xml).toContain(
        '[&gt;=1000000]#,##0.0,,&quot;tr&quot;;[&gt;=1000]#,##0,&quot;k&quot;;&quot;&quot;',
      );
    });

    it('cột chồng: nhãn ở giữa đoạn (outEnd không hợp lệ cho cột chồng)', () => {
      const xml = buildChartXml(
        spec({ stacked: true, dataLabels: true }),
        'Dash',
      );
      parse(xml);
      expect(xml).toContain('<c:dLblPos val="ctr"/>');
      expect(xml).not.toContain('<c:dLblPos val="outEnd"/>');
    });

    it('đường: nhãn phía trên điểm', () => {
      const xml = buildChartXml(
        spec({
          type: 'line',
          dataLabels: true,
          series: [spec().series[0]],
        }),
        'Dash',
      );
      expect(xml).toContain('<c:dLblPos val="t"/>');
    });

    it('bật nhãn riêng theo series: chỉ series được bật có dLbls', () => {
      const xml = buildChartXml(
        spec({
          series: [
            { ...spec().series[0], dataLabels: true, labelNumFmt: '0%' },
            spec().series[1],
          ],
        }),
        'Dash',
      );
      expect(xml.match(/<c:dLbls>/g)).toHaveLength(1);
      expect(xml).toContain(
        '<c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr>',
      );
    });

    it('doughnut: nhãn % và không có dLblPos', () => {
      const xml = buildChartXml(
        spec({ type: 'doughnut', series: [spec().series[0]] }),
        'Dash',
      );
      parse(xml);
      expect(xml).toContain('<c:showPercent val="1"/>');
      expect(xml).not.toContain('<c:dLblPos');
    });
  });

  describe('giá trị null (ô trống)', () => {
    it('bỏ qua điểm null nhưng giữ ptCount và chỉ số các điểm còn lại', () => {
      const xml = buildChartXml(
        spec({
          type: 'line',
          series: [
            {
              name: '%',
              valuesRef: '$B$2:$B$4',
              values: [0.4, null, 0.5],
              color: 'CA8A04',
            },
          ],
          categories: ['T1', 'T2', 'T3'],
        }),
        'Dash',
      );
      parse(xml);
      const cache = /<c:numCache>.*?<\/c:numCache>/.exec(xml)![0];
      expect(cache).toContain('<c:ptCount val="3"/>');
      expect(cache).toContain('<c:pt idx="0"><c:v>0.4</c:v></c:pt>');
      expect(cache).not.toContain('idx="1"');
      expect(cache).toContain('<c:pt idx="2"><c:v>0.5</c:v></c:pt>');
    });
  });

  describe('cận trục phụ', () => {
    const combo = (extra: Partial<XlsxChartSpec>) =>
      buildChartXml(
        spec({
          type: 'combo',
          series: [
            ...spec().series,
            {
              name: '%',
              valuesRef: '$D$2:$D$3',
              values: [0.4, 0.5],
              color: 'E11D48',
              kind: 'line',
              secondaryAxis: true,
            },
          ],
          ...extra,
        }),
        'Dash',
      );

    it('mặc định tự động (không có min/max)', () => {
      const xml = combo({});
      expect(xml).not.toContain('<c:min val=');
      expect(xml).not.toContain('<c:max val=');
    });

    it('secondaryMin/Max đặt đúng thứ tự orientation, max, min trong scaling của trục phụ', () => {
      const xml = combo({ secondaryMin: 0, secondaryMax: 1 });
      parse(xml);
      expect(xml).toContain(
        '<c:scaling><c:orientation val="minMax"/><c:max val="1"/><c:min val="0"/></c:scaling>',
      );
      // trục chính không bị ảnh hưởng
      expect(xml.match(/<c:min val=/g)).toHaveLength(1);
    });
  });
});
