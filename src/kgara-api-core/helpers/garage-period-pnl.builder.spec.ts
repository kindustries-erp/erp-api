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
      '1. Doanh thu',
      '1.1 Doanh thu',
      '2. Chi phí',
      '2.1 Chi phí phụ tùng ngoài & Gia công ngoài',
      '3. Lợi nhuận gộp',
      '4. Chi phí vận hành',
      '4.1 Nhân sự',
      '4.2 Thuê mặt bằng & điện nước',
      '4.3 Vật tư tiêu hao',
      '4.4 Bảo trì',
      '4.5 Khấu hao máy móc & thiết bị',
      '5. Lợi nhuận ròng (trước hoa hồng)',
      '6. Hoa hồng',
      '6.1 Tỷ lệ lãi gộp ký gửi / Lãi gộp',
      '6.2 Hoa hồng cho Sale (10%)',
      '6.3 Hoa hồng cho DV (10%)',
      '7. Lợi nhuận ròng (sau hoa hồng)',
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
    const rate = rows.find((r) => r.label.includes('Tỷ lệ'))!;
    expect(rate.value).toBeCloseTo(0.125, 6);
    expect(rate.numFmt).toBe('0.00%');
  });
});

describe('buildPnlSheet', () => {
  it('chart xếp dọc trong cùng cột E:N, trên hàng 40 để bảng + 2 chart gọn một màn hình', async () => {
    const wb = new ExcelJS.Workbook();
    const [combo, stacked] = buildPnlSheet(wb, twelveMonths());

    expect(combo.anchor).toMatchObject({ fromCol: 4, toCol: 14, fromRow: 3 });
    expect(stacked.anchor).toMatchObject({ fromCol: 4, toCol: 14 });
    // chart 2 nằm ngay dưới chart 1, không chồng lên nhau
    expect(stacked.anchor.fromRow).toBe(combo.anchor.toRow);
    expect(stacked.anchor.toRow).toBeLessThanOrEqual(40);

    // bảng dữ liệu biểu đồ nằm dưới màn hình đầu, không dưới chart
    const sheet = wb.getWorksheet(PNL_SHEET)!;
    expect(sheet.getCell('E44').value).toContain('Dữ liệu biểu đồ');
    expect(sheet.pageSetup.printArea).toBe('A1:N41');
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
    expect(sheet.getCell('I46').value).toBeNull();
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
    expect(sheet.getCell('B4').value).toBe('Tháng 07/2026');
    expect(sheet.getCell('C4').value).toBe('Tháng trước 06/2026');
    expect(sheet.getCell('A5').value).toBe('1. Doanh thu');
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
  /** Bỏ số thứ bậc để so sánh tên dòng. */
  const plain = (label: string) => label.replace(/^\d+(\.\d+)*\.? /, '');
  const rowsOf = (m: PnlMonthRow) =>
    buildPnlTableRows(m).map((r) => ({ ...r, label: plain(r.label) }));
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
    const rows = rowsOf(detailed());
    const labelsOf = (from: string, to: string) => {
      const a = rows.findIndex((r) => r.label === from);
      const b = rows.findIndex((r) => r.label === to);
      return rows.slice(a, b).map((r) => [r.level, r.label, r.value]);
    };
    expect(labelsOf('Doanh thu', 'Chi phí')).toEqual([
      [1, 'Doanh thu', 1000],
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
    const rows = rowsOf(detailed());
    const a = rows.findIndex((r) => r.label === 'Chi phí');
    const b = rows.findIndex((r) => r.label === 'Lợi nhuận gộp');
    expect(rows.slice(a, b).map((r) => [r.level, r.label, r.value])).toEqual([
      [1, 'Chi phí', 700],
      [2, 'Giá vốn từ phiếu (phụ tùng ngoài & gia công ngoài)', 600],
      [3, 'Ký gửi / Nội bộ', 250],
      [3, 'Sửa chữa chung', 350],
      [2, 'Điều chỉnh giá vốn nhập tay', 100],
      [3, 'Vật tư tiêu hao - Dầu nhớt xưởng', 100],
    ]);
  });

  it('chi phí vận hành: hạng mục cộng dòng cùng khóa, từng dòng nhập ở cấp 3', () => {
    const rows = rowsOf(detailed());
    const a = rows.findIndex((r) => r.label === 'Chi phí vận hành');
    const b = rows.findIndex((r) =>
      r.label.startsWith('Lợi nhuận ròng (trước'),
    );
    expect(rows.slice(a, b).map((r) => [r.level, r.label, r.value])).toEqual([
      [1, 'Chi phí vận hành', 150],
      [2, 'Nhân sự', 130],
      [3, 'Lương T10', 100],
      [3, 'Khoản chi', 30],
      [2, 'Bảo trì', 20], // một dòng không ghi chú: không mở cấp 3
    ]);
  });

  it('nhóm VI gồm cả HHBH nên V - VI = VII', () => {
    const rows = rowsOf(detailed());
    const value = (name: string) => rows.find((r) => r.label === name)!.value;
    expect(value('Hoa hồng')).toBe(60);
    expect(rows.find((r) => r.label === 'HHBH')).toMatchObject({
      level: 2,
      value: 40,
    });
    expect(value('Lợi nhuận ròng (trước hoa hồng)') - value('Hoa hồng')).toBe(
      value('Lợi nhuận ròng (sau hoa hồng)'),
    );
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

describe('buildPnlSheet - cột tháng trước và vùng in', () => {
  it('cột C là tháng trước: cùng dòng khớp theo khóa, dòng chỉ có ở tháng này thì tháng trước là 0', () => {
    const wb = new ExcelJS.Workbook();
    const months = twelveMonths();
    months[10] = month(2026, 6, { revenue: 300000000, cogs: 100000000 });
    buildPnlSheet(wb, months);
    const sheet = wb.getWorksheet(PNL_SHEET)!;

    expect(sheet.getCell('C5').value).toBe(300000000); // 1. Doanh thu
    expect(sheet.getCell('B5').value).toBe(444218804);
    // dòng cấp 2 "Chi phí vận hành" của Nhân sự: tháng trước cùng số dòng (vì dựng từ cùng tháng)
    const nhanSu = [
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      25, 26,
    ].find((r) => sheet.getCell(`A${r}`).value === '4.1 Nhân sự')!;
    expect(sheet.getCell(`C${nhanSu}`).value).toBe(76500000);
  });

  it('chỉ có một tháng: cột tháng trước để trống, không lỗi', () => {
    const wb = new ExcelJS.Workbook();
    buildPnlSheet(wb, [month(2026, 7)]);
    const sheet = wb.getWorksheet(PNL_SHEET)!;

    expect(sheet.getCell('C4').value).toBe('Tháng trước');
    expect(sheet.getCell('C5').value).toBeNull();
  });

  it('dòng chi tiết nhập tay không có ở tháng trước thì để trống, không đoán 0', () => {
    const wb = new ExcelJS.Workbook();
    const current = month(2026, 7, {
      opexItems: [
        {
          categoryKey: 'BAO_TRI',
          categoryName: 'Bảo trì',
          amount: 10,
          note: 'Thay lốp',
        },
        {
          categoryKey: 'BAO_TRI',
          categoryName: 'Bảo trì',
          amount: 5,
          note: 'Sơn',
        },
      ],
    });
    buildPnlSheet(wb, [month(2026, 6), current]);
    const sheet = wb.getWorksheet(PNL_SHEET)!;
    const rowOf = (label: string) => {
      let found = 0;
      sheet.eachRow((row, r) => {
        if (row.getCell(1).value === label) found = r;
      });
      return found;
    };
    // hạng mục Bảo trì tháng trước có cùng khóa (10 triệu), nên hiện số tháng trước
    expect(sheet.getCell(`C${rowOf('4.1 Bảo trì')}`).value).toBe(10000000);
    // dòng nhập "Thay lốp" không có ở tháng trước: để trống
    expect(sheet.getCell(`C${rowOf('4.1.1 Thay lốp')}`).value).toBeNull();
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
      `A1:N${5 + rows.length}`,
    );
  });
});
