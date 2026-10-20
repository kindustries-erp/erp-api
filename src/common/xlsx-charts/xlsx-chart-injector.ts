import JSZip from 'jszip';

import type { XlsxChartSpec } from './xlsx-chart.types';
import { buildChartXml, buildDrawingXml } from './xlsx-chart-xml';

const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_TYPE_CHART =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const REL_TYPE_DRAWING =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const CT_CHART =
  'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';

/** Phần tử đứng SAU `<drawing>` trong worksheet (thứ tự CT_Worksheet). */
const AFTER_DRAWING = [
  '<legacyDrawing',
  '<legacyDrawingHF',
  '<drawingHF',
  '<picture',
  '<oleObjects',
  '<controls',
  '<webPublishItems',
  '<tableParts',
  '<extLst',
];

const decodeXml = (v: string) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Thiếu phần '${path}' trong file xlsx.`);
  return file.async('string');
}

/** Tên sheet → đường dẫn part worksheet (qua workbook.xml + workbook.xml.rels). */
async function resolveSheetPath(
  zip: JSZip,
  sheetName: string,
): Promise<string> {
  const workbook = await readText(zip, 'xl/workbook.xml');
  const rels = await readText(zip, 'xl/_rels/workbook.xml.rels');

  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => {
      const name = /\bname="([^"]*)"/.exec(tag)?.[1];
      return name !== undefined && decodeXml(name) === sheetName;
    });
  if (!sheetTag) throw new Error(`Không tìm thấy sheet '${sheetName}'.`);

  const rId = /\br:id="([^"]*)"/.exec(sheetTag)?.[1];
  const relTag = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => /\bId="([^"]*)"/.exec(tag)?.[1] === rId);
  const target = relTag && /\bTarget="([^"]*)"/.exec(relTag)?.[1];
  if (!target)
    throw new Error(`Không tìm thấy quan hệ của sheet '${sheetName}'.`);

  const clean = target.replace(/^\/?(xl\/)?/, '');
  return `xl/${clean}`;
}

const nextIndex = (zip: JSZip, dir: string, prefix: string, ext: string) => {
  const re = new RegExp(`^${dir}/${prefix}(\\d+)\\.${ext}$`);
  const used = Object.keys(zip.files)
    .map((p) => re.exec(p)?.[1])
    .filter(Boolean)
    .map(Number);
  return used.length ? Math.max(...used) + 1 : 1;
};

function nextRelId(relsXml: string): string {
  const used = [...relsXml.matchAll(/\bId="rId(\d+)"/g)].map((m) => +m[1]);
  return `rId${used.length ? Math.max(...used) + 1 : 1}`;
}

function insertDrawingElement(sheetXml: string, rId: string): string {
  if (/<drawing\b/.test(sheetXml)) {
    throw new Error('Sheet đã có <drawing>; chưa hỗ trợ ghép thêm chart.');
  }
  let xml = sheetXml;
  if (!/xmlns:r=/.test(xml)) {
    xml = xml.replace(
      /<worksheet\b/,
      '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    );
  }
  const element = `<drawing r:id="${rId}"/>`;
  const positions = AFTER_DRAWING.map((tag) => xml.indexOf(tag)).filter(
    (i) => i >= 0,
  );
  const at = positions.length
    ? Math.min(...positions)
    : xml.lastIndexOf('</worksheet>');
  return xml.slice(0, at) + element + xml.slice(at);
}

function addContentTypes(xml: string, overrides: [string, string][]): string {
  const add = overrides
    .filter(([part]) => !xml.includes(`PartName="${part}"`))
    .map(
      ([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`,
    )
    .join('');
  return xml.replace('</Types>', `${add}</Types>`);
}

/**
 * Chèn các chart gốc (OOXML) vào sheet `sheetName` của file xlsx do exceljs sinh ra
 * (exceljs 4.x không hỗ trợ chart). Chart tham chiếu ô trên chính sheet đó.
 */
export async function injectCharts(
  xlsx: Buffer | Uint8Array | ArrayBuffer,
  sheetName: string,
  charts: XlsxChartSpec[],
): Promise<Buffer> {
  if (charts.length === 0) return Buffer.from(xlsx as ArrayBuffer);

  const zip = await JSZip.loadAsync(xlsx);
  const sheetPath = await resolveSheetPath(zip, sheetName);
  const sheetFile = sheetPath.split('/').pop() as string;
  const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;

  const drawingIdx = nextIndex(zip, 'xl/drawings', 'drawing', 'xml');
  const firstChartIdx = nextIndex(zip, 'xl/charts', 'chart', 'xml');

  const overrides: [string, string][] = [
    [`/xl/drawings/drawing${drawingIdx}.xml`, CT_DRAWING],
  ];
  const drawingRelIds: string[] = [];
  let drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">`;

  charts.forEach((spec, i) => {
    const idx = firstChartIdx + i;
    zip.file(`xl/charts/chart${idx}.xml`, buildChartXml(spec, sheetName));
    overrides.push([`/xl/charts/chart${idx}.xml`, CT_CHART]);
    drawingRelIds.push(`rId${i + 1}`);
    drawingRels += `<Relationship Id="rId${i + 1}" Type="${REL_TYPE_CHART}" Target="../charts/chart${idx}.xml"/>`;
  });
  drawingRels += '</Relationships>';

  zip.file(
    `xl/drawings/drawing${drawingIdx}.xml`,
    buildDrawingXml(charts, drawingRelIds),
  );
  zip.file(`xl/drawings/_rels/drawing${drawingIdx}.xml.rels`, drawingRels);

  // Quan hệ sheet → drawing
  const existingRels = zip.file(sheetRelsPath)
    ? await readText(zip, sheetRelsPath)
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"></Relationships>`;
  const sheetRelId = nextRelId(existingRels);
  zip.file(
    sheetRelsPath,
    existingRels.replace(
      '</Relationships>',
      `<Relationship Id="${sheetRelId}" Type="${REL_TYPE_DRAWING}" Target="../drawings/drawing${drawingIdx}.xml"/></Relationships>`,
    ),
  );

  zip.file(
    sheetPath,
    insertDrawingElement(await readText(zip, sheetPath), sheetRelId),
  );
  zip.file(
    '[Content_Types].xml',
    addContentTypes(await readText(zip, '[Content_Types].xml'), overrides),
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
