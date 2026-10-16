import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { injectCharts } from '../../common/xlsx-charts/xlsx-chart-injector';
import {
  PNL_SHEET,
  buildPnlSheet,
  buildPnlTableRows,
} from './garage-period-pnl.builder';
import {
  LABEL_MONEY_FMT,
  LABEL_PERCENT_FMT,
} from '../../common/xlsx-charts/xlsx-chart.types';
import type { PnlMonthRow } from './garage-pnl-month.helper';

const month = (
  year: number,
  m: number,
  patch: Partial<PnlMonthRow> = {},
): PnlMonthRow => ({
  year,
  month: m,
  revenue: 444218804,
  cogs: 241508218,
  grossProfit: 202710586,
  grossMarginRate: 45.63,
  opexTotal: 146500000,
  opexItems: [
    { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 76500000 },
    {
      categoryKey: 'THUE_MAT_BANG',
      categoryName: 'Thuê mặt bằng & điện nước',
      amount: 30000000,
    },
    {
      categoryKey: 'VAT_TU_TIEU_HAO',
      categoryName: 'Vật tư tiêu hao',
      amount: 15000000,
    },
    { categoryKey: 'BAO_TRI', categoryName: 'Bảo trì', amount: 10000000 },
    {
      categoryKey: 'KHAU_HAO',
      categoryName: 'Khấu hao máy móc & thiết bị',
      amount: 15000000,
    },
  ],
  netBeforeCommission: 56210586,
  commissionTotal: 5621059,
  commissionItems: [
    {
      categoryKey: 'RATE_LAI_GOP_KY_GUI',
      categoryName: 'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
      amount: 0,
    },
    {
      categoryKey: 'HOA_HONG_SALE',
      categoryName: 'Hoa hồng cho Sale (10%)',
      amount: 0,
    },
    {
      categoryKey: 'HOA_HONG_DV',
      categoryName: 'Hoa hồng cho DV (10%)',
      amount: 5621059,
    },
  ],
  netAfterCommission: 50589527,
  ...patch,
});

const twelveMonths = () =>
  Array.from({ length: 12 }, (_, i) => {
    const idx = 2025 * 12 + 7 + i; // 2025-08 .. 2026-07
    return month(Math.floor(idx / 12), (idx % 12) + 1);
  });

describe('buildPnlTableRows', () => {
  it('bảng đúng thứ tự: doanh thu, chi phí, lãi gộp, vận hành từng khoản, ròng, hoa hồng', () => {
    const rows = buildPnlTableRows(month(2026, 7));
    expect(rows.map((r) => r.label)).toEqual([
      'I. Doanh thu',
      'Doanh thu',
      'II. Chi phí',
      'Chi phí phụ tùng ngoài & Gia công ngoài',
      'III. Lợi nhuận gộp',
      'IV. Chi phí vận hành',
      'Nhân sự',
      'Thuê mặt bằng & điện nước',
      'Vật tư tiêu hao',
      'Bảo trì',
      'Khấu hao máy móc & thiết bị',
      'V. Lợi nhuận ròng (trước hoa hồng)',
      'VI. Hoa hồng',
      'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
      'Hoa hồng cho Sale (10%)',
      'Hoa hồng cho DV (10%)',
      'VII. Lợi nhuận ròng (sau hoa hồng)',
    ]);
    expect(rows.filter((r) => r.group).map((r) => r.value)).toEqual([
      444218804, 241508218, 202710586, 146500000, 56210586, 5621059, 50589527,
    ]);
  });

  it('dòng tỷ lệ ký gửi lưu theo %, đổi sang tỷ lệ với định dạng phần trăm', () => {
    const rows = buildPnlTableRows(
      month(2026, 7, {
        commissionItems: [
          {
            categoryKey: 'RATE_LAI_GOP_KY_GUI',
            categoryName: 'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
            amount: 12.5,
          },
        ],
      }),
    );
    const rate = rows.find((r) => r.label.startsWith('Tỷ lệ'))!;
    expect(rate.value).toBeCloseTo(0.125, 6);
    expect(rate.numFmt).toBe('0.00%');
  });
});

describe('buildPnlSheet', () => {
  it('chart xếp dọc trong cùng cột D:M, trên hàng 40 để bảng + 2 chart gọn một màn hình', async () => {
    const wb = new ExcelJS.Workbook();
    const [combo, stacked] = buildPnlSheet(wb, twelveMonths());

    expect(combo.anchor).toMatchObject({ fromCol: 3, toCol: 13, fromRow: 3 });
    expect(stacked.anchor).toMatchObject({ fromCol: 3, toCol: 13 });
    // chart 2 nằm ngay dưới chart 1, không chồng lên nhau
    expect(stacked.anchor.fromRow).toBe(combo.anchor.toRow);
    expect(stacked.anchor.toRow).toBeLessThanOrEqual(40);

    // bảng dữ liệu biểu đồ nằm dưới màn hình đầu, không dưới chart
    const sheet = wb.getWorksheet(PNL_SHEET)!;
    expect(sheet.getCell('D44').value).toContain('Dữ liệu biểu đồ');
    expect(sheet.pageSetup.printArea).toBe('A1:M41');
  });

  it('bật nhãn số: tiền theo triệu cho cột, % cho đường, % ẩn dưới 1% cho cột chồng', () => {
    const wb = new ExcelJS.Workbook();
    const [combo, stacked] = buildPnlSheet(wb, twelveMonths());

    expect(combo).toMatchObject({
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
      labelFontSize: 700,
    });
    expect(combo.series[3].labelNumFmt).toBe('0%');
    expect(stacked).toMatchObject({
      dataLabels: true,
      labelNumFmt: LABEL_PERCENT_FMT,
    });
  });

  it('tháng không có doanh thu: % lợi nhuận gộp để trống (null) thay vì 0%', () => {
    const wb = new ExcelJS.Workbook();
    const months = twelveMonths();
    months[0] = month(2025, 8, { revenue: 0, cogs: 0, grossProfit: 0 });
    const [combo] = buildPnlSheet(wb, months);

    const line = combo.series[3].values;
    expect(line[0]).toBeNull();
    expect(line[1]).toBeCloseTo(202710586 / 444218804, 6);
    // ô trong bảng dữ liệu cũng để trống
    const sheet = wb.getWorksheet(PNL_SHEET)!;
    expect(sheet.getCell('H46').value).toBeNull();
  });

  const build = async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Dashboard');
    const charts = buildPnlSheet(wb, twelveMonths());
    let buffer: Buffer = Buffer.from(await wb.xlsx.writeBuffer());
    buffer = await injectCharts(buffer, PNL_SHEET, charts);
    return { charts, buffer };
  };

  it('tiêu đề ghi tháng báo cáo (tháng cuối) và bảng nằm ở cột A:B từ dòng 4', async () => {
    const wb = new ExcelJS.Workbook();
    buildPnlSheet(wb, twelveMonths());
    const sheet = wb.getWorksheet(PNL_SHEET)!;

    expect(sheet.getCell('A1').value).toBe('Báo cáo lợi nhuận - Tháng 07/2026');
    expect(sheet.getCell('A4').value).toBe('Danh mục');
    expect(sheet.getCell('B4').value).toBe('Giá trị');
    expect(sheet.getCell('A5').value).toBe('I. Doanh thu');
    expect(sheet.getCell('B5').value).toBe(444218804);
    expect(sheet.getCell('A5').font?.bold).toBe(true);
    expect(sheet.getCell('A6').font?.bold).toBe(false);
  });

  it('2 chart 12 tháng: combo có % lợi nhuận gộp trên trục phụ, tỷ trọng là cột chồng 7 series', async () => {
    const { charts } = await build();
    expect(charts).toHaveLength(2);

    const [combo, stacked] = charts;
    expect(combo.type).toBe('combo');
    expect(combo.categories).toHaveLength(12);
    expect(combo.categories[0]).toBe('2025-thg 8');
    expect(combo.categories[11]).toBe('2026-thg 7');
    expect(combo.series.map((s) => s.name)).toEqual([
      'Doanh thu',
      'Chi phí',
      'Lợi nhuận gộp',
      '% Lợi nhuận gộp',
    ]);
    const line = combo.series[3];
    expect(line).toMatchObject({ kind: 'line', secondaryAxis: true });
    expect(line.values[0]).toBeCloseTo(202710586 / 444218804, 6);

    expect(stacked.stacked).toBe(true);
    expect(stacked.series).toHaveLength(7);
    // Tổng tỷ trọng một tháng = (cogs + vận hành) / doanh thu
    const total = stacked.series.reduce(
      (acc, s) => acc + (s.values[0] ?? 0),
      0,
    );
    expect(total).toBeCloseTo((241508218 + 146500000) / 444218804, 6);
  });

  it('chart được chèn vào đúng sheet với trục phụ và grouping stacked', async () => {
    const { buffer } = await build();
    const zip = await JSZip.loadAsync(buffer);
    const chartFiles = Object.keys(zip.files).filter((p) =>
      /^xl\/charts\/chart\d+\.xml$/.test(p),
    );
    expect(chartFiles).toHaveLength(2);
    const xmls = await Promise.all(
      chartFiles.map((p) => zip.file(p)!.async('string')),
    );

    expect(xmls.some((x) => x.includes('<c:axPos val="r"/>'))).toBe(true);
    expect(xmls.some((x) => x.includes('<c:grouping val="stacked"/>'))).toBe(
      true,
    );
    expect(xmls.every((x) => x.includes("'Báo cáo lợi nhuận'!"))).toBe(true);
  });

  it('không có tháng nào thì chỉ có tiêu đề và không có chart', () => {
    const wb = new ExcelJS.Workbook();
    expect(buildPnlSheet(wb, [])).toEqual([]);
    expect(wb.getWorksheet(PNL_SHEET)!.getCell('A1').value).toBe(
      'Báo cáo lợi nhuận',
    );
  });

  it('doanh thu 0 thì tỷ lệ là 0, không NaN', () => {
    const wb = new ExcelJS.Workbook();
    const charts = buildPnlSheet(wb, [month(2026, 7, { revenue: 0 })]);
    expect(charts[0].series[3].values).toEqual([null]);
    expect(charts[1].series.every((s) => s.values.every((v) => v === 0))).toBe(
      true,
    );
  });
});
