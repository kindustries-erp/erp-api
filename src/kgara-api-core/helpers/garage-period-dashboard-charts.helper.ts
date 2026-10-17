import * as ExcelJS from 'exceljs';

import { writeDataTable } from '../../common/xlsx-charts/dashboard-sheet.helper';
import {
  CHART_PALETTE,
  LABEL_MONEY_FMT,
  type XlsxChartSpec,
} from '../../common/xlsx-charts/xlsx-chart.types';
import {
  BUCKET_UNIT_LABEL,
  buildCashflowSeries,
} from './garage-period-series.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';
import type { PeriodSummary } from './garage-period-summary.builder';

/** Chiều cao (số dòng) của chart cột 1 và 2; chart cột 3 cao hơn để đáy ba chart ngang nhau. */
export const PERIOD_CHART_ROWS = 18;

/**
 * Dải cột (0-based, [từ, đến)) của 3 cột báo cáo: thu chi (A–F), tuổi nợ (G–L), phát sinh theo
 * nhóm khách (M–R). Mỗi cột có tiêu đề riêng và thẻ nằm trong cột chart của nó.
 */
export const PERIOD_CHART_BANDS: [number, number][] = [
  [0, 6],
  [6, 12],
  [12, 18],
];

const MONEY = '#,##0';
const COLUMN_WIDTHS = [34, 18, 18, 18, 18];
const AGING_LABELS = ['0-30 ngày', '31-60 ngày', '61-90 ngày', 'Trên 90 ngày'];
const GROUP_LABELS: Record<string, string> = {
  enterprise: 'Doanh nghiệp',
  individual: 'Cá nhân',
  insurance: 'Bảo hiểm',
};

type Row = (string | number)[];

const column = (rows: Row[], idx: number) =>
  rows.map((r) => Number(r[idx]) || 0);

/** Chart không có điểm nào vẫn cần một dòng để vùng tham chiếu hợp lệ. */
const orEmpty = (rows: Row[], width: number): Row[] =>
  rows.length > 0 ? rows : [['Không có dữ liệu', ...Array(width - 1).fill(0)]];

/**
 * Chart của báo cáo kỳ: thu vs chi + dự chi + dòng tiền ròng, tuổi nợ phải thu vs phải trả
 * (cột 1, 2, bắt đầu ở `chartTop`) và phải thu/chi theo nhóm khách (cột 3, bắt đầu ở `groupTop`).
 * Bảng dữ liệu chart xếp dọc từ cột `dataStartCol` (ngoài vùng in).
 */
export function buildDashboardCharts(
  sheet: ExcelJS.Worksheet,
  data: GaragePeriodReportData,
  summary: PeriodSummary,
  chartTop: number,
  groupTop: number,
  dataStartCol: number,
): XlsxChartSpec[] {
  const col = dataStartCol;
  const large = (slot: number) => {
    const [fromCol, toCol] = PERIOD_CHART_BANDS[slot];
    const top = slot === 2 ? groupTop : chartTop;
    return {
      fromCol,
      fromRow: top - 1,
      toCol,
      toRow: chartTop - 1 + PERIOD_CHART_ROWS,
    };
  };

  const cash = buildCashflowSeries(data);
  const cashUnit = BUCKET_UNIT_LABEL[cash.unit];
  const cashRows = orEmpty(
    cash.points.map(
      (p): Row => [p.label, p.thu, p.chi, p.planned, p.thu - p.chi],
    ),
    5,
  );
  const cashTable = writeDataTable(sheet, {
    startRow: chartTop,
    startCol: col,
    columnWidths: COLUMN_WIDTHS,
    title: `Dữ liệu biểu đồ: Thu vs chi theo ${cashUnit}`,
    headers: ['Mốc thời gian', 'Thu', 'Chi', 'Dự chi', 'Dòng tiền ròng'],
    rows: cashRows,
    numFmts: [undefined, MONEY, MONEY, MONEY, MONEY],
  });

  const agingRows: Row[] = [
    [AGING_LABELS[0], summary.receivable.b0_30, summary.payable.b0_30],
    [AGING_LABELS[1], summary.receivable.b31_60, summary.payable.b31_60],
    [AGING_LABELS[2], summary.receivable.b61_90, summary.payable.b61_90],
    [AGING_LABELS[3], summary.receivable.over90, summary.payable.over90],
  ];
  const agingTable = writeDataTable(sheet, {
    startRow: cashTable.nextRow,
    startCol: col,
    columnWidths: COLUMN_WIDTHS,
    title: 'Dữ liệu biểu đồ: Tuổi nợ phải thu vs phải trả',
    headers: ['Khoảng tuổi nợ', 'Phải thu', 'Phải trả'],
    rows: agingRows,
    numFmts: [undefined, MONEY, MONEY],
  });

  // Phải thu phát sinh và chi phí hồ sơ theo nhóm khách: nhóm không có phiếu và không có số tiền thì bỏ qua
  // Mỗi nhóm khách tách thành Có VAT / Không VAT theo hồ sơ; nhóm rỗng thì bỏ qua
  const sumOf = (cases: { totalAmount: number; costAmount?: number }[]) => [
    cases.reduce((acc, c) => acc + c.totalAmount, 0),
    cases.reduce((acc, c) => acc + (c.costAmount ?? 0), 0),
  ];
  const groupRows = orEmpty(
    (data.customerSections ?? []).flatMap((s) =>
      [
        { suffix: 'Có VAT', vat: true },
        { suffix: 'Không VAT', vat: false },
      ]
        .map(({ suffix, vat }): Row => {
          const cases = s.cases.filter((c) => Boolean(c.hasVat) === vat);
          const [receivable, cost] = sumOf(cases);
          return [
            `${GROUP_LABELS[s.key] ?? s.title} - ${suffix}`,
            receivable,
            cost,
          ];
        })
        .filter((r) => Number(r[1]) !== 0 || Number(r[2]) !== 0),
    ),
    3,
  );
  const groupTable = writeDataTable(sheet, {
    startRow: agingTable.nextRow,
    startCol: col,
    columnWidths: COLUMN_WIDTHS,
    title: 'Dữ liệu biểu đồ: Phải thu phát sinh và phải chi theo nhóm khách',
    headers: ['Nhóm khách', 'Phải thu', 'Phải chi'],
    rows: groupRows,
    numFmts: [undefined, MONEY, MONEY],
  });

  return [
    {
      type: 'combo',
      title: `Thu vs chi theo ${cashUnit}`,
      anchor: large(0),
      categoriesRef: cashTable.ref(0),
      categories: cashRows.map((r) => String(r[0])),
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      labelFontSize: 700,
      series: [
        {
          name: 'Thu',
          valuesRef: cashTable.ref(1),
          values: column(cashRows, 1),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Chi',
          valuesRef: cashTable.ref(2),
          values: column(cashRows, 2),
          color: CHART_PALETTE[3],
        },
        {
          name: 'Dự chi',
          valuesRef: cashTable.ref(3),
          values: column(cashRows, 3),
          color: CHART_PALETTE[6],
        },
        {
          name: 'Dòng tiền ròng',
          valuesRef: cashTable.ref(4),
          values: column(cashRows, 4),
          color: CHART_PALETTE[2],
          kind: 'line',
          dataLabels: false,
        },
      ],
    },
    {
      type: 'column',
      title: 'Tuổi nợ phải thu vs phải trả',
      anchor: large(1),
      categoriesRef: agingTable.ref(0),
      categories: AGING_LABELS,
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      series: [
        {
          name: 'Phải thu',
          valuesRef: agingTable.ref(1),
          values: column(agingRows, 1),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Phải trả',
          valuesRef: agingTable.ref(2),
          values: column(agingRows, 2),
          color: CHART_PALETTE[1],
        },
      ],
    },
    {
      type: 'column',
      title: 'Phải thu phát sinh và phải chi theo nhóm khách',
      anchor: large(2),
      categoriesRef: groupTable.ref(0),
      categories: groupRows.map((r) => String(r[0])),
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      series: [
        {
          name: 'Phải thu',
          valuesRef: groupTable.ref(1),
          values: column(groupRows, 1),
          color: CHART_PALETTE[0],
        },
        {
          name: 'Phải chi',
          valuesRef: groupTable.ref(2),
          values: column(groupRows, 2),
          color: CHART_PALETTE[1],
        },
      ],
    },
  ];
}
