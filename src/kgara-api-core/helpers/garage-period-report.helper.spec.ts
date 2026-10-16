import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';

import type { GarageDebtExportRow } from './garage-debts-export.helper';
import { buildGaragePeriodReport } from './garage-period-report.helper';
import type { PnlMonthRow } from './garage-pnl-month.helper';
import type { GaragePeriodReportData } from './garage-period-report.types';

const debtRow = (patch: Partial<GarageDebtExportRow>): GarageDebtExportRow => ({
  licensePlate: '30A-111.11',
  partnerCode: 'KH01',
  partnerName: 'Công ty A',
  caseCount: 1,
  totalAmount: 0,
  paidAmount: 0,
  balanceAmount: 0,
  aging0_30: 0,
  aging31_60: 0,
  aging61_90: 0,
  agingOver90: 0,
  maxAgingDays: 0,
  ...patch,
});

const pnlMonths = (): PnlMonthRow[] =>
  Array.from({ length: 12 }, (_, i) => {
    const idx = 2025 * 12 + 7 + i; // 2025-08 .. 2026-07
    return {
      year: Math.floor(idx / 12),
      month: (idx % 12) + 1,
      revenue: 1000,
      cogs: 600,
      grossProfit: 400,
      grossMarginRate: 40,
      opexTotal: 100,
      opexItems: [
        { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 100 },
      ],
      netBeforeCommission: 300,
      commissionTotal: 30,
      commissionItems: [],
      netAfterCommission: 270,
    };
  });

const baseData = (
  patch: Partial<GaragePeriodReportData> = {},
): GaragePeriodReportData => ({
  from: '2026-10-01',
  to: '2026-10-31',
  asOfDate: new Date(2026, 9, 16),
  branchLabel: 'Chi nhánh Quận 7',
  pnlMonths: pnlMonths(),
  vouchers: [
    {
      voucherCode: 'PT001',
      transDate: '2026-10-05',
      type: 'RECEIPT',
      paymentContent: '1. KH thanh toán',
      partnerName: 'Công ty A',
      licensePlate: '30A-111.11',
      soChungTu: 'GR-PDV2610-0001',
      paymentMethod: 'CASH',
      note: '',
      amount: 700,
    },
    {
      voucherCode: 'PC001',
      transDate: '2026-10-06',
      type: 'PAYMENT',
      paymentContent: '',
      partnerName: 'NCC B',
      licensePlate: '',
      soChungTu: '',
      paymentMethod: 'BANK_TRANSFER',
      note: '',
      amount: 200,
    },
  ],
  customerRows: [debtRow({ balanceAmount: 500, aging0_30: 500 })],
  supplierRows: [
    debtRow({
      partnerCode: 'NCC9',
      partnerName: 'Phụ tùng B',
      balanceAmount: 300,
      aging31_60: 300,
    }),
  ],
  customerSections: [
    {
      key: 'enterprise',
      title: 'Thu Khách hàng Doanh nghiệp',
      partnerCount: 1,
      caseCount: 1,
      vehicleCount: 1,
      totalAmount: 800,
      paidAmount: 300,
      balanceAmount: 500,
      cases: [
        {
          caseId: 'c1',
          soChungTu: 'PDV-001',
          bienSoXe: '30A-111.11',
          partnerTitle: 'Công ty A',
          payerType: 'KH',
          invoiceAndVat: '',
          totalAmount: 800,
          paidAmount: 300,
          balanceAmount: 500,
          aging0_30: 500,
          aging31_60: 0,
          aging61_90: 0,
          agingOver90: 0,
          shareRate: 1,
          maxAgingDays: 5,
        },
      ],
    },
  ],
  openCustomerRows: [
    debtRow({
      partnerName: 'Nhỏ',
      licensePlate: '',
      balanceAmount: 1000,
      agingOver90: 1000,
      maxAgingDays: 120,
    }),
    debtRow({
      partnerName: 'Lớn',
      licensePlate: '51K-222.22',
      balanceAmount: 5000000,
      agingOver90: 5000000,
      maxAgingDays: 200,
    }),
    debtRow({ partnerName: 'Mới', balanceAmount: 100, aging0_30: 100 }),
  ],
  openSupplierRows: [
    debtRow({
      partnerCode: 'NCC9',
      partnerName: 'Phụ tùng B',
      balanceAmount: 300,
      aging31_60: 300,
      maxAgingDays: 40,
    }),
  ],
  ...patch,
});

const load = async (buffer: Buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  return wb;
};

const chartCount = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((p) =>
    /^xl\/charts\/chart\d+\.xml$/.test(p),
  ).length;
};

/** Giá trị thẻ KPI: nhãn ở dòng r, giá trị ở dòng r+1 cùng cột. */
const kpiValue = (sheet: ExcelJS.Worksheet, label: string) => {
  let found: unknown;
  sheet.eachRow((row, r) => {
    row.eachCell((cell, c) => {
      if (cell.value === label) found = sheet.getCell(r + 1, c).value;
    });
  });
  return found;
};

/** Thẻ cảnh báo: nhãn ở dòng r, giá trị r+1, ghi chú r+2 (cùng cột). */
const card = (sheet: ExcelJS.Worksheet, label: string) => {
  let found: { value: unknown; note: unknown } | undefined;
  sheet.eachRow((row, r) => {
    row.eachCell((cell, c) => {
      if (cell.value === label)
        found = {
          value: sheet.getCell(r + 1, c).value,
          note: sheet.getCell(r + 2, c).value,
        };
    });
  });
  if (!found) throw new Error(`Không thấy thẻ ${label}`);
  return found;
};

describe('buildGaragePeriodReport', () => {
  it('thứ tự sheet: Dashboard, Báo cáo lợi nhuận, nhóm phải thu, phải trả, nợ quá hạn, thu chi', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Dashboard',
      'Báo cáo lợi nhuận',
      'Thu Khách hàng Doanh nghiệp',
      'Công nợ phải trả',
      'Nợ quá hạn cần chú ý',
      'Thu chi trong kỳ',
    ]);
  });

  it('thiếu phân nhóm thì dùng sheet Công nợ phải thu phẳng', async () => {
    const wb = await load(
      await buildGaragePeriodReport(baseData({ customerSections: undefined })),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Dashboard',
      'Báo cáo lợi nhuận',
      'Công nợ phải thu',
      'Công nợ phải trả',
      'Nợ quá hạn cần chú ý',
      'Thu chi trong kỳ',
    ]);
  });

  it('Dashboard: tiêu đề và một dòng phụ gộp kỳ, ngày xuất, chi nhánh', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const dash = wb.getWorksheet('Dashboard')!;

    expect(dash.getCell('A1').value).toBe('Dashboard thu chi & công nợ Garage');
    expect(dash.getCell('A2').value).toBe(
      'Kỳ: 01/10/2026 - 31/10/2026 · Số dư, tuổi nợ tính đến 16/10/2026 · Chi nhánh: Chi nhánh Quận 7',
    );
  });

  it('Dashboard: cảnh báo quá hạn dạng card cho phải thu và phải trả, không còn dòng chữ banner', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const dash = wb.getWorksheet('Dashboard')!;

    const level = (label: string) => card(dash, label);
    expect(level('PHẢI THU: MỨC CẢNH BÁO')).toMatchObject({ value: 'CAO' });
    expect(level('PHẢI TRẢ: MỨC CẢNH BÁO')).toMatchObject({ value: 'CHÚ Ý' });

    const over90 = card(dash, 'PHẢI THU: NỢ TRÊN 90 NGÀY');
    expect(over90.value).toBe(5001000);
    expect(over90.note).toBe(
      '2 đối tượng; lớn nhất: 51K-222.22 - Lớn (5.000.000 đ)',
    );
    expect(card(dash, 'PHẢI TRẢ: NỢ 31-60 NGÀY')).toMatchObject({
      value: 300,
      note: '1 đối tượng',
    });
    expect(card(dash, 'PHẢI THU: NỢ 61-90 NGÀY')).toMatchObject({ value: 0 });

    const banner: string[] = [];
    dash.eachRow((row) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string' && v.startsWith('CẢNH BÁO QUÁ HẠN'))
        banner.push(v);
    });
    expect(banner).toEqual([]);
  });

  it('Dashboard: chỉ 4 KPI (đã thu, đã chi, còn phải thu, còn phải trả), bỏ các KPI phụ và P&L', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const dash = wb.getWorksheet('Dashboard')!;

    expect(kpiValue(dash, 'ĐÃ THU TRONG KỲ')).toBe(700);
    expect(kpiValue(dash, 'ĐÃ CHI TRONG KỲ')).toBe(200);
    expect(kpiValue(dash, 'CÒN PHẢI THU (NỢ MỞ)')).toBe(5001100);
    expect(kpiValue(dash, 'CÒN PHẢI TRẢ (NỢ MỞ)')).toBe(300);
    for (const removed of [
      'DÒNG TIỀN RÒNG (THU - CHI)',
      'SỐ PHIẾU THU / CHI',
      'NỢ QUÁ HẠN >30 NGÀY',
      '% NỢ QUÁ HẠN / TỔNG NỢ',
      'DOANH THU TRONG KỲ',
      'LÃI GỘP TRONG KỲ',
    ]) {
      expect(kpiValue(dash, removed)).toBeUndefined();
    }
  });

  it('sheet Báo cáo lợi nhuận: bảng tháng báo cáo (tháng cuối) và 2 chart', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const pnl = wb.getWorksheet('Báo cáo lợi nhuận')!;
    expect(pnl.getCell('A1').value).toBe('Báo cáo lợi nhuận - Tháng 07/2026');
    expect(pnl.getCell('A5').value).toBe('I. Doanh thu');
    expect(pnl.getCell('B5').value).toBe(1000);
  });

  it('5 chart khi có phân nhóm (3 dashboard + 2 P&L), 4 chart khi không có; không còn chart top 10 và cơ cấu tuổi nợ', async () => {
    const withSections = await buildGaragePeriodReport(baseData());
    expect(await chartCount(withSections)).toBe(5);
    expect(
      await chartCount(
        await buildGaragePeriodReport(
          baseData({ customerSections: undefined }),
        ),
      ),
    ).toBe(4);

    const zip = await JSZip.loadAsync(withSections);
    const xmls = await Promise.all(
      Object.keys(zip.files)
        .filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p))
        .map((p) => zip.file(p)!.async('string')),
    );
    expect(xmls.some((x) => x.includes('Top 10'))).toBe(false);
    expect(xmls.some((x) => x.includes('Cơ cấu tuổi nợ'))).toBe(false);
    expect(xmls.some((x) => x.includes("'Dashboard'!"))).toBe(true);
    expect(xmls.some((x) => x.includes("'Báo cáo lợi nhuận'!"))).toBe(true);
    // mọi chart đều có nhãn số
    expect(xmls.every((x) => x.includes('<c:dLbls>'))).toBe(true);
  });

  it('Dashboard gọn một màn hình: 3 chart cùng một hàng chia đều 16 cột, có ghi chú nguồn số liệu', async () => {
    const buffer = await buildGaragePeriodReport(baseData());
    const zip = await JSZip.loadAsync(buffer);
    const drawings = await Promise.all(
      Object.keys(zip.files)
        .filter((p) => /^xl\/drawings\/drawing\d+\.xml$/.test(p))
        .map((p) => zip.file(p)!.async('string')),
    );
    // drawing đầu là của Dashboard (3 chart), drawing sau là của P&L (2 chart)
    const dashboardDrawing = drawings.find(
      (d) => (d.match(/<xdr:twoCellAnchor/g) ?? []).length === 3,
    )!;
    const cols = [
      ...dashboardDrawing.matchAll(/<xdr:from><xdr:col>(\d+)<\/xdr:col>/g),
    ].map((m) => +m[1]);
    const rows = [
      ...dashboardDrawing.matchAll(
        /<xdr:to><xdr:col>\d+<\/xdr:col><xdr:colOff>0<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/g,
      ),
    ].map((m) => +m[1]);
    expect(cols).toEqual([0, 5, 11]);
    expect(new Set(rows).size).toBe(1);
    // chart kết thúc trong khoảng 36 hàng đầu (vừa một màn hình)
    expect(rows[0]).toBeLessThanOrEqual(36);

    const wb = await load(buffer);
    const dash = wb.getWorksheet('Dashboard')!;
    let footnote = '';
    dash.eachRow((row) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string' && v.startsWith('Nguồn số liệu')) footnote = v;
    });
    expect(footnote).toContain('Báo cáo lợi nhuận');
  });

  it('sheet nợ quá hạn: chỉ nợ trên 30 ngày, nợ >90 ngày lớn nhất lên đầu, có cả phải trả', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const sheet = wb.getWorksheet('Nợ quá hạn cần chú ý')!;

    expect(sheet.getRow(4).getCell(1).value).toBe('STT');
    const names = [5, 6, 7, 8].map((r) => sheet.getRow(r).getCell(5).value);
    expect(names).toEqual(['Lớn', 'Nhỏ', 'Phụ tùng B', null]);
    expect(sheet.getRow(5).getCell(2).value).toBe('Phải thu');
    expect(sheet.getRow(7).getCell(2).value).toBe('Phải trả');
  });

  it('sheet thu chi: số tiền tách cột Thu và Chi, tổng khớp', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const sheet = wb.getWorksheet('Thu chi trong kỳ')!;
    const header = sheet.getRow(4).values as unknown[];
    const receiptIdx = header.indexOf('Thu');
    const paymentIdx = header.indexOf('Chi');

    expect(sheet.getRow(5).getCell(receiptIdx).value).toBe(700);
    expect(sheet.getRow(5).getCell(paymentIdx).value).toBeNull();
    expect(sheet.getRow(6).getCell(paymentIdx).value).toBe(200);
    expect(sheet.getRow(5).getCell(9).value).toBe('Tiền mặt');
    expect((sheet.getRow(1).getCell(receiptIdx).value as any).result).toBe(700);
    expect((sheet.getRow(1).getCell(paymentIdx).value as any).result).toBe(200);
  });

  it('không có dữ liệu vẫn tạo file hợp lệ và cả hai phía ở mức ỔN', async () => {
    const wb = await load(
      await buildGaragePeriodReport(
        baseData({
          vouchers: [],
          customerRows: [],
          supplierRows: [],
          customerSections: undefined,
          openCustomerRows: [],
          openSupplierRows: [],
          pnlMonths: [],
        }),
      ),
    );
    const dash = wb.getWorksheet('Dashboard')!;
    expect(card(dash, 'PHẢI THU: MỨC CẢNH BÁO').value).toBe('ỔN');
    expect(card(dash, 'PHẢI TRẢ: MỨC CẢNH BÁO').value).toBe('ỔN');
    expect(kpiValue(dash, 'CÒN PHẢI THU (NỢ MỞ)')).toBe(0);
    expect(wb.getWorksheet('Báo cáo lợi nhuận')!.getCell('A1').value).toBe(
      'Báo cáo lợi nhuận',
    );
  });
});
