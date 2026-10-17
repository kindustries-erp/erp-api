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
  cogsDirect: 241508218,
  cogsAdjustmentItems: [],
  revenueSegments: [],
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
  hhbhTotal: 0,
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
    expect(rows.filter((r) => r.level === 1).map((r) => r.value)).toEqual([
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

describe('buildPnlTableRows - 3 cấp', () => {
  const detailed = () =>
    month(2026, 10, {
      revenue: 1000,
      cogs: 700,
      cogsDirect: 600,
      grossProfit: 300,
      cogsAdjustmentItems: [
        {
          categoryKey: 'VAT_TU_TIEU_HAO',
          categoryName: 'Vật tư tiêu hao',
          amount: 100,
          note: 'Dầu nhớt xưởng',
        },
      ],
      revenueSegments: [
        {
          key: 'KY_GUI',
          label: 'Ký gửi / Nội bộ',
          caseCount: 2,
          revenue: 400,
          cogs: 250,
        },
        {
          key: 'SUA_CHUA_CHUNG',
          label: 'Sửa chữa chung',
          caseCount: 3,
          revenue: 600,
          cogs: 350,
        },
        { key: 'OJ', label: 'OJ', caseCount: 0, revenue: 0, cogs: 0 },
        { key: 'KHAC', label: 'Khác', caseCount: 0, revenue: 0, cogs: 0 },
      ],
      opexTotal: 150,
      opexItems: [
        {
          categoryKey: 'NHAN_SU',
          categoryName: 'Nhân sự',
          amount: 100,
          note: 'Lương T10',
        },
        { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 30 },
        { categoryKey: 'BAO_TRI', categoryName: 'Bảo trì', amount: 20 },
      ],
      netBeforeCommission: 150,
      hhbhTotal: 40,
      commissionTotal: 20,
      commissionItems: [
        {
          categoryKey: 'HOA_HONG_DV',
          categoryName: 'Hoa hồng cho DV (10%)',
          amount: 20,
        },
      ],
      netAfterCommission: 90,
    });

  it('doanh thu: phân loại (cấp 2) kèm số phiếu (cấp 3), bỏ phân loại trống', () => {
    const rows = buildPnlTableRows(detailed());
    const labelsOf = (from: string, to: string) => {
      const a = rows.findIndex((r) => r.label === from);
      const b = rows.findIndex((r) => r.label === to);
      return rows.slice(a, b).map((r) => [r.level, r.label, r.value]);
    };
    expect(labelsOf('I. Doanh thu', 'II. Chi phí')).toEqual([
      [1, 'I. Doanh thu', 1000],
      [2, 'Ký gửi / Nội bộ', 400],
      [3, 'Số phiếu hoàn thành', 2],
      [2, 'Sửa chữa chung', 600],
      [3, 'Số phiếu hoàn thành', 3],
    ]);
    expect(rows.find((r) => r.label === 'Số phiếu hoàn thành')!.numFmt).toBe(
      '#,##0',
    );
  });

  it('chi phí: giá vốn từ phiếu theo phân loại và điều chỉnh giá vốn nhập tay từng dòng', () => {
    const rows = buildPnlTableRows(detailed());
    const a = rows.findIndex((r) => r.label === 'II. Chi phí');
    const b = rows.findIndex((r) => r.label === 'III. Lợi nhuận gộp');
    expect(rows.slice(a, b).map((r) => [r.level, r.label, r.value])).toEqual([
      [1, 'II. Chi phí', 700],
      [2, 'Giá vốn từ phiếu (phụ tùng ngoài & gia công ngoài)', 600],
      [3, 'Ký gửi / Nội bộ', 250],
      [3, 'Sửa chữa chung', 350],
      [2, 'Điều chỉnh giá vốn nhập tay', 100],
      [3, 'Vật tư tiêu hao - Dầu nhớt xưởng', 100],
    ]);
  });

  it('chi phí vận hành: hạng mục cộng dòng cùng khóa, từng dòng nhập ở cấp 3', () => {
    const rows = buildPnlTableRows(detailed());
    const a = rows.findIndex((r) => r.label === 'IV. Chi phí vận hành');
    const b = rows.findIndex((r) => r.label.startsWith('V. '));
    expect(rows.slice(a, b).map((r) => [r.level, r.label, r.value])).toEqual([
      [1, 'IV. Chi phí vận hành', 150],
      [2, 'Nhân sự', 130],
      [3, 'Lương T10', 100],
      [3, 'Khoản chi', 30],
      [2, 'Bảo trì', 20], // một dòng không ghi chú: không mở cấp 3
    ]);
  });

  it('nhóm VI gồm cả HHBH nên V - VI = VII', () => {
    const rows = buildPnlTableRows(detailed());
    const value = (prefix: string) =>
      rows.find((r) => r.label.startsWith(prefix))!.value;
    expect(value('VI.')).toBe(60);
    expect(rows.find((r) => r.label === 'HHBH')).toMatchObject({
      level: 2,
      value: 40,
    });
    expect(value('V.') - value('VI.')).toBe(value('VII.'));
  });

  it('không có HHBH thì không thêm dòng HHBH', () => {
    const rows = buildPnlTableRows(month(2026, 7));
    expect(rows.some((r) => r.label === 'HHBH')).toBe(false);
  });

  it('bảng ghi thụt lề theo cấp: cấp 1 đậm nền xám, cấp 3 chữ nghiêng', () => {
    const wb = new ExcelJS.Workbook();
    buildPnlSheet(wb, [detailed()]);
    const sheet = wb.getWorksheet(PNL_SHEET)!;
    expect(sheet.getCell('A5').font?.bold).toBe(true);
    expect(sheet.getCell('A5').alignment?.indent).toBe(1);
    expect(sheet.getCell('A6').alignment?.indent).toBe(2);
    expect(sheet.getCell('A7').font?.italic).toBe(true);
    expect(sheet.getCell('A7').alignment?.indent).toBe(4);
  });
});

describe('buildPnlSheet - chart theo kỳ báo cáo', () => {
  const timeline = {
    unitLabel: 'tuần',
    points: [
      { label: 'Tuần 28/09', revenue: 1000, cogs: 600 },
      { label: 'Tuần 05/10', revenue: 0, cogs: 0 },
    ],
  };

  it('có timeline: 3 chart, chart theo kỳ ở đầu, bảng dữ liệu và vùng in dời xuống', () => {
    const wb = new ExcelJS.Workbook();
    const charts = buildPnlSheet(wb, twelveMonths(), timeline);

    expect(charts).toHaveLength(3);
    const [byPeriod, combo, stacked] = charts;
    expect(byPeriod.title).toBe('Doanh thu, giá vốn, lãi gộp theo tuần');
    expect(byPeriod.anchor).toMatchObject({ fromRow: 3, toRow: 21 });
    expect(combo.anchor).toMatchObject({ fromRow: 21, toRow: 39 });
    expect(stacked.anchor).toMatchObject({ fromRow: 39, toRow: 57 });

    const sheet = wb.getWorksheet(PNL_SHEET)!;
    expect(sheet.pageSetup.printArea).toBe('A1:M59');
    expect(sheet.getCell('D62').value).toContain('Dữ liệu biểu đồ');
  });

  it('chart theo kỳ: cột doanh thu / giá vốn / lãi gộp, đường % lãi gộp (null khi không có doanh thu)', () => {
    const wb = new ExcelJS.Workbook();
    const [byPeriod] = buildPnlSheet(wb, twelveMonths(), timeline);

    expect(byPeriod.series.map((s) => s.name)).toEqual([
      'Doanh thu',
      'Giá vốn từ phiếu',
      'Lợi nhuận gộp',
      '% Lợi nhuận gộp',
    ]);
    expect(byPeriod.series[2].values).toEqual([400, 0]);
    expect(byPeriod.series[3].values).toEqual([0.4, null]);
    expect(byPeriod).toMatchObject({
      dataLabels: true,
      labelNumFmt: LABEL_MONEY_FMT,
    });
  });

  it('timeline rỗng hoặc không truyền thì vẫn 2 chart như cũ', () => {
    const wb = new ExcelJS.Workbook();
    expect(buildPnlSheet(wb, twelveMonths())).toHaveLength(2);
    const wb2 = new ExcelJS.Workbook();
    expect(
      buildPnlSheet(wb2, twelveMonths(), { unitLabel: 'ngày', points: [] }),
    ).toHaveLength(2);
  });

  it('bảng P&L dài hơn vùng chart thì vùng in kéo theo số dòng bảng', () => {
    const wb = new ExcelJS.Workbook();
    const items = Array.from({ length: 60 }, (_, i) => ({
      categoryKey: `K${i}`,
      categoryName: `Hạng mục ${i}`,
      amount: 1,
    }));
    buildPnlSheet(wb, [month(2026, 7, { opexItems: items })]);
    const rows = buildPnlTableRows(month(2026, 7, { opexItems: items }));
    expect(wb.getWorksheet(PNL_SHEET)!.pageSetup.printArea).toBe(
      `A1:M${5 + rows.length}`,
    );
  });
});
