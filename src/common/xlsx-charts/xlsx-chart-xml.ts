import {
  CHART_PALETTE,
  type XlsxChartSeries,
  type XlsxChartSpec,
} from './xlsx-chart.types';

export const NS_CHART =
  'http://schemas.openxmlformats.org/drawingml/2006/chart';
export const NS_DRAWING_MAIN =
  'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NS_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NS_SPREADSHEET_DRAWING =
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

const CAT_AX_ID = 50010;
const VAL_AX_ID = 50020;
const SEC_CAT_AX_ID = 50030;
const SEC_VAL_AX_ID = 50040;

/** Bỏ ký tự điều khiển không hợp lệ trong XML 1.0 (giữ tab, xuống dòng). */
function stripInvalidXmlChars(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('');
}

export function escapeXml(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `'Tên sheet'!$A$1:$A$5` — nhân đôi dấu nháy đơn theo quy tắc Excel. */
export function qualifyRef(sheetName: string, ref: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!${ref}`;
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

function numCache(values: (number | null)[], fmt: string): string {
  const pts = values
    .map((v, i) =>
      v === null ? '' : `<c:pt idx="${i}"><c:v>${finite(v)}</c:v></c:pt>`,
    )
    .join('');
  return `<c:numCache><c:formatCode>${escapeXml(fmt)}</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`;
}

function strCache(values: string[]): string {
  const pts = values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`)
    .join('');
  return `<c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache>`;
}

const solid = (hex: string) =>
  `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;

type LabelPosition = 'outEnd' | 'ctr' | 't';

function dataLabels(
  show: 'val' | 'percent' | 'none',
  fmt: string,
  size = 800,
  position?: LabelPosition,
): string {
  const val = show === 'val' ? 1 : 0;
  const pct = show === 'percent' ? 1 : 0;
  if (show === 'none') return '';
  return (
    `<c:dLbls><c:numFmt formatCode="${escapeXml(show === 'percent' ? '0%' : fmt)}" sourceLinked="0"/>` +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}"/></a:pPr><a:endParaRPr lang="vi-VN"/></a:p></c:txPr>` +
    (position ? `<c:dLblPos val="${position}"/>` : '') +
    `<c:showLegendKey val="0"/><c:showVal val="${val}"/><c:showCatName val="0"/>` +
    `<c:showSerName val="0"/><c:showPercent val="${pct}"/><c:showBubbleSize val="0"/>` +
    (show === 'percent' ? '<c:showLeaderLines val="1"/>' : '') +
    `</c:dLbls>`
  );
}

/** Nhãn giá trị của một series cột/đường theo cấu hình series, rồi đến cấu hình chart. */
function seriesLabels(
  spec: XlsxChartSpec,
  series: XlsxChartSeries,
  fmt: string,
  position: LabelPosition,
): string {
  const on = series.dataLabels ?? spec.dataLabels ?? false;
  return dataLabels(
    on ? 'val' : 'none',
    series.labelNumFmt ?? spec.labelNumFmt ?? fmt,
    spec.labelFontSize,
    position,
  );
}

function catAndVal(
  spec: XlsxChartSpec,
  sheetName: string,
  series: XlsxChartSeries,
  fmt: string,
): string {
  return (
    `<c:cat><c:strRef><c:f>${escapeXml(qualifyRef(sheetName, spec.categoriesRef))}</c:f>${strCache(spec.categories)}</c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${escapeXml(qualifyRef(sheetName, series.valuesRef))}</c:f>${numCache(series.values, fmt)}</c:numRef></c:val>`
  );
}

function serHead(index: number, series: XlsxChartSeries): string {
  return `<c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${escapeXml(series.name)}</c:v></c:tx>`;
}

function barSeries(
  spec: XlsxChartSpec,
  sheetName: string,
  series: XlsxChartSeries,
  index: number,
  fmt: string,
): string {
  return (
    `<c:ser>${serHead(index, series)}` +
    `<c:spPr>${solid(series.color)}</c:spPr><c:invertIfNegative val="0"/>` +
    seriesLabels(spec, series, fmt, spec.stacked ? 'ctr' : 'outEnd') +
    catAndVal(spec, sheetName, series, fmt) +
    `</c:ser>`
  );
}

function lineSeries(
  spec: XlsxChartSpec,
  sheetName: string,
  series: XlsxChartSeries,
  index: number,
  fmt: string,
): string {
  return (
    `<c:ser>${serHead(index, series)}` +
    `<c:spPr><a:ln w="28575" cap="rnd">${solid(series.color)}<a:round/></a:ln></c:spPr>` +
    `<c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${solid(series.color)}</c:spPr></c:marker>` +
    seriesLabels(spec, series, fmt, 't') +
    catAndVal(spec, sheetName, series, fmt) +
    `<c:smooth val="0"/></c:ser>`
  );
}

function doughnutSeries(
  spec: XlsxChartSpec,
  sheetName: string,
  series: XlsxChartSeries,
  index: number,
  fmt: string,
): string {
  const colors = spec.pointColors?.length ? spec.pointColors : CHART_PALETTE;
  const points = series.values
    .map(
      (_, i) =>
        `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${solid(colors[i % colors.length])}<a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    )
    .join('');
  return (
    `<c:ser>${serHead(index, series)}${points}` +
    dataLabels('percent', fmt, spec.labelFontSize) +
    catAndVal(spec, sheetName, series, fmt) +
    `</c:ser>`
  );
}

/** Trục phụ bên phải cho series đường (trục danh mục phụ bị ẩn). */
function secondaryAxes(
  spec: XlsxChartSpec,
  secFmt: string,
  txPr: string,
): string {
  // Thứ tự trong <c:scaling>: orientation, max, min
  const max =
    spec.secondaryMax === undefined
      ? ''
      : `<c:max val="${spec.secondaryMax}"/>`;
  const min =
    spec.secondaryMin === undefined
      ? ''
      : `<c:min val="${spec.secondaryMin}"/>`;
  return (
    `<c:valAx><c:axId val="${SEC_VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/>${max}${min}</c:scaling><c:delete val="0"/>` +
    `<c:axPos val="r"/><c:numFmt formatCode="${escapeXml(secFmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/>${txPr}<c:crossAx val="${SEC_CAT_AX_ID}"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>` +
    `<c:catAx><c:axId val="${SEC_CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="1"/>` +
    `<c:axPos val="b"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:crossAx val="${SEC_VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
  );
}

function axes(spec: XlsxChartSpec, fmt: string, hasSecondary = false): string {
  const horizontal = spec.type === 'bar';
  const catPos = horizontal ? 'l' : 'b';
  const valPos = horizontal ? 'b' : 'l';
  const reverse = spec.reverseCategories === true;
  const txPr = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="vi-VN"/></a:p></c:txPr>`;
  return (
    `<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="${reverse ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${catPos}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/>${txPr}<c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/>` +
    `<c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${valPos}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` +
    `<c:numFmt formatCode="${escapeXml(fmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/>${txPr}<c:crossAx val="${CAT_AX_ID}"/><c:crosses val="${reverse ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>` +
    (hasSecondary
      ? secondaryAxes(spec, spec.secondaryNumFmt ?? '0.0%', txPr)
      : '')
  );
}

function plotArea(spec: XlsxChartSpec, sheetName: string, fmt: string): string {
  if (spec.type === 'doughnut') {
    const series = spec.series[0];
    return (
      `<c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/>` +
      doughnutSeries(spec, sheetName, series, 0, fmt) +
      `<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart></c:plotArea>`
    );
  }

  const isLine = (s: XlsxChartSeries) =>
    spec.type === 'line' || (spec.type === 'combo' && s.kind === 'line');
  const isSecondary = (s: XlsxChartSeries) =>
    spec.type === 'combo' && isLine(s) && s.secondaryAxis === true;
  const secFmt = spec.secondaryNumFmt ?? '0.0%';
  const axRefs = `<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/>`;
  const secAxRefs = `<c:axId val="${SEC_CAT_AX_ID}"/><c:axId val="${SEC_VAL_AX_ID}"/>`;

  const indexed = spec.series.map((s, i) => ({ s, i }));
  const bars = indexed
    .filter(({ s }) => !isLine(s))
    .map(({ s, i }) => barSeries(spec, sheetName, s, i, fmt))
    .join('');
  const lineChartXml = (
    items: { s: XlsxChartSeries; i: number }[],
    seriesFmt: string,
    refs: string,
  ) =>
    items.length > 0
      ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${items
          .map(({ s, i }) => lineSeries(spec, sheetName, s, i, seriesFmt))
          .join('')}<c:marker val="1"/>${refs}</c:lineChart>`
      : '';
  const primaryLines = indexed.filter(({ s }) => isLine(s) && !isSecondary(s));
  const secondaryLines = indexed.filter(({ s }) => isSecondary(s));

  const grouping = spec.stacked ? 'stacked' : 'clustered';
  const overlap = spec.stacked ? '<c:overlap val="100"/>' : '';
  const barXml = bars
    ? `<c:barChart><c:barDir val="${spec.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${bars}<c:gapWidth val="80"/>${overlap}${axRefs}</c:barChart>`
    : '';
  const lineXml =
    lineChartXml(primaryLines, fmt, axRefs) +
    lineChartXml(secondaryLines, secFmt, secAxRefs);

  return `<c:plotArea><c:layout/>${barXml}${lineXml}${axes(spec, fmt, secondaryLines.length > 0)}</c:plotArea>`;
}

/** XML của một chart (`xl/charts/chartN.xml`). */
export function buildChartXml(spec: XlsxChartSpec, sheetName: string): string {
  const fmt = spec.numFmt ?? '#,##0';
  const title =
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr>` +
    `<a:r><a:rPr lang="vi-VN" sz="1200" b="1"/><a:t>${escapeXml(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  const legend =
    spec.series.length > 1 || spec.type === 'doughnut'
      ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>`
      : '';

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="${NS_CHART}" xmlns:a="${NS_DRAWING_MAIN}" xmlns:r="${NS_REL}">` +
    `<c:roundedCorners val="0"/><c:chart>${title}<c:autoTitleDeleted val="0"/>` +
    plotArea(spec, sheetName, fmt) +
    `${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></c:spPr>` +
    `</c:chartSpace>`
  );
}

/** XML drawing chứa các `twoCellAnchor`, mỗi chart tham chiếu `rIdN` trong rels. */
export function buildDrawingXml(
  specs: XlsxChartSpec[],
  relIds: string[],
): string {
  const anchors = specs
    .map((spec, i) => {
      const a = spec.anchor;
      return (
        `<xdr:twoCellAnchor editAs="oneCell">` +
        `<xdr:from><xdr:col>${a.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${a.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
        `<a:graphic><a:graphicData uri="${NS_CHART}"><c:chart xmlns:c="${NS_CHART}" r:id="${relIds[i]}"/></a:graphicData></a:graphic>` +
        `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
      );
    })
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="${NS_SPREADSHEET_DRAWING}" xmlns:a="${NS_DRAWING_MAIN}" xmlns:r="${NS_REL}">${anchors}</xdr:wsDr>`
  );
}
