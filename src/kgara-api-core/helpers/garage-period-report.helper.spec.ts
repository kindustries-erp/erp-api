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
      cogsDirect: 600,
      cogsAdjustmentItems: [],
      revenueSegments: [],
      grossProfit: 400,
      grossMarginRate: 40,
      opexTotal: 100,
      opexItems: [
        { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 100 },
      ],
      netBeforeCommission: 300,
      hhbhTotal: 0,
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

  it('reportType=all giống hệt khi không truyền reportType', async () => {
    const names = async (reportType?: 'all') =>
      (
        await load(await buildGaragePeriodReport(baseData({ reportType })))
      ).worksheets.map((w) => w.name);
    expect(await names('all')).toEqual(await names());
  });

  it('reportType=business: chỉ sheet Báo cáo lợi nhuận kèm 2 chart (12 tháng)', async () => {
    const buffer = await buildGaragePeriodReport(
      baseData({ reportType: 'business' }),
    );
    const wb = await load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Báo cáo lợi nhuận']);
    expect(await chartCount(buffer)).toBe(2);
  });

  it('reportType=cashflow-debts: dashboard, công nợ, thu chi; không có P&L và nợ quá hạn', async () => {
    const buffer = await buildGaragePeriodReport(
      baseData({ reportType: 'cashflow-debts' }),
    );
    const wb = await load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Dashboard',
      'Thu Khách hàng Doanh nghiệp',
      'Công nợ phải trả',
      'Thu chi trong kỳ',
    ]);
    // 3 chart lớn + 2 mini chart của Dashboard, không có chart P&L
    expect(await chartCount(buffer)).toBe(3);
    const dash = wb.getWorksheet('Dashboard')!;
    expect(kpiValue(dash, 'DỰ CHI TRONG KỲ')).toBeUndefined();
    expect(kpiValue(dash, 'DOANH THU')).toBeUndefined();
  });

  it('reportType=overdue: chỉ sheet nợ quá hạn, không chart', async () => {
    const buffer = await buildGaragePeriodReport(
      baseData({ reportType: 'overdue' }),
    );
    const wb = await load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Nợ quá hạn cần chú ý']);
    expect(await chartCount(buffer)).toBe(0);
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

  it('Dashboard: không còn thẻ thu chi; dự chi, đã thu, đã chi, dòng tiền ròng nằm ở chart', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const dash = wb.getWorksheet('Dashboard')!;

    expect(kpiValue(dash, 'DỰ CHI TRONG KỲ')).toBeUndefined();
    // các card đã bỏ
    expect(kpiValue(dash, 'ĐÃ THU TRONG KỲ')).toBeUndefined();
    expect(kpiValue(dash, 'ĐÃ CHI TRONG KỲ')).toBeUndefined();
    expect(kpiValue(dash, 'DÒNG TIỀN RÒNG (THU - CHI)')).toBeUndefined();
    expect(kpiValue(dash, 'DOANH THU')).toBeUndefined();
  });

  it('Dashboard: công nợ phát sinh trong kỳ cho từng phía', async () => {
    const wb = await load(
      await buildGaragePeriodReport(
        baseData({
          customerRows: [
            debtRow({ totalAmount: 1000, paidAmount: 400, balanceAmount: 600 }),
          ],
          supplierRows: [
            debtRow({ totalAmount: 300, paidAmount: 100, balanceAmount: 200 }),
          ],
        }),
      ),
    );
    const dash = wb.getWorksheet('Dashboard')!;

    const values = (label: string) => {
      const out: unknown[] = [];
      dash.eachRow((row, r) =>
        row.eachCell((cell, c) => {
          // ô gộp lặp giá trị ở mọi cột: chỉ lấy ô chính
          if (cell.value === label && cell.master === cell)
            out.push(dash.getCell(r + 1, c).value);
        }),
      );
      return out;
    };
    expect(values('PHẢI THU PHÁT SINH TRONG KỲ (KH)')).toEqual([1000]);
    expect(values('PHẢI TRẢ PHÁT SINH TRONG KỲ (NCC)')).toEqual([300]);
    // chỉ giữ số phát sinh: không còn đã thu/đã trả/còn lại
    expect(values('ĐÃ THU')).toEqual([]);
    expect(values('ĐÃ TRẢ')).toEqual([]);
    expect(values('CÒN LẠI')).toEqual([]);
  });

  it('Dashboard: không còn thẻ cảnh báo lũy kế (tuổi nợ đã thể hiện ở chart), không ghi số đối tượng', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const dash = wb.getWorksheet('Dashboard')!;

    const texts: string[] = [];
    dash.eachRow((row) =>
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') texts.push(cell.value);
      }),
    );
    // không ghi số đối tượng trên card (vd "2 đối tượng")
    expect(texts.some((t) => /\d+ đối tượng/.test(t))).toBe(false);
    // các thẻ đã bỏ
    expect(texts).not.toContain('PHẢI THU: NỢ 61-90 NGÀY');
    expect(texts).not.toContain('PHẢI THU: NỢ TRÊN 90 NGÀY');
    expect(texts).not.toContain('PHẢI TRẢ: NỢ 61-90 NGÀY');
    expect(texts).not.toContain('PHẢI TRẢ: NỢ TRÊN 90 NGÀY');
    expect(texts).not.toContain('PHẢI THU: TỔNG NỢ CÒN MỞ');
    expect(texts).not.toContain('PHẢI THU: NỢ 31-60 NGÀY');
    expect(texts).not.toContain('PHẢI THU: TỶ LỆ QUÁ HẠN');
  });

  it('sheet Báo cáo lợi nhuận: bảng tháng báo cáo (tháng cuối)', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const pnl = wb.getWorksheet('Báo cáo lợi nhuận')!;
    expect(pnl.getCell('A1').value).toBe('Báo cáo lợi nhuận - Tháng 07/2026');
    expect(pnl.getCell('A5').value).toBe('1. Doanh thu');
    expect(pnl.getCell('B5').value).toBe(1000);
  });

  it('5 chart: 3 ở Dashboard (thu chi, tuổi nợ, phải thu theo nhóm) và 2 ở Báo cáo lợi nhuận', async () => {
    for (const patch of [{}, { customerSections: undefined }]) {
      const buffer = await buildGaragePeriodReport(baseData(patch));
      expect(await chartCount(buffer)).toBe(5);
    }

    const zip = await JSZip.loadAsync(
      await buildGaragePeriodReport(baseData()),
    );
    const xmls = await Promise.all(
      Object.keys(zip.files)
        .filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p))
        .map((p) => zip.file(p)!.async('string')),
    );
    expect(xmls.filter((x) => x.includes("'Dashboard'!"))).toHaveLength(3);
    expect(xmls.filter((x) => x.includes("'Báo cáo lợi nhuận'!"))).toHaveLength(
      2,
    );
    // mọi chart có tiêu đề đều có nhãn số (mini chart không tiêu đề, không nhãn)
    expect(
      xmls
        .filter((x) => x.includes('<c:title>'))
        .every((x) => x.includes('<c:dLbls>')),
    ).toBe(true);
    // chart theo thời gian có tên theo đơn vị gom (kỳ tháng → tuần)
    const titles = xmls.join('');
    expect(titles).toContain('Thu vs chi theo tuần');
    expect(titles).not.toContain('Công nợ phát sinh vs đã thu/trả');
  });

  it('đơn vị gom đổi theo kỳ: tuần → ngày, quý → tháng', async () => {
    const chartTitles = async (patch: object) => {
      const zip = await JSZip.loadAsync(
        await buildGaragePeriodReport(baseData(patch)),
      );
      const xmls = await Promise.all(
        Object.keys(zip.files)
          .filter((p) => /^xl\/charts\/chart\d+\.xml$/.test(p))
          .map((p) => zip.file(p)!.async('string')),
      );
      return xmls.join('');
    };
    const week = await chartTitles({ from: '2026-10-12', to: '2026-10-18' });
    expect(week).toContain('Thu vs chi theo ngày');
    const quarter = await chartTitles({ from: '2026-10-01', to: '2026-12-31' });
    expect(quarter).toContain('Thu vs chi theo tháng');
  });

  it('Dashboard: bảng dữ liệu biểu đồ nằm ngoài vùng in và có ghi chú nguồn số liệu', async () => {
    const wb = await load(await buildGaragePeriodReport(baseData()));
    const dash = wb.getWorksheet('Dashboard')!;
    let footnote = '';
    const tableTitles: string[] = [];
    dash.eachRow((row) =>
      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v !== 'string') return;
        if (v.startsWith('Chart thu chi theo')) footnote = v;
        if (v.startsWith('Dữ liệu biểu đồ')) tableTitles.push(v);
      }),
    );
    expect(tableTitles).toHaveLength(3);
    expect(tableTitles).toContain(
      'Dữ liệu biểu đồ: Phải thu phát sinh và phải chi theo nhóm khách',
    );
    expect(footnote).toContain('Công nợ lũy kế');
    expect(footnote).toContain('theo tuần');
    expect(dash.pageSetup.printArea).toMatch(/^A1:P\d+$/);
    // gọn một màn hình: vùng in không quá 34 dòng
    const lastPrintRow = Number(dash.pageSetup.printArea?.match(/\d+$/)?.[0]);
    expect(lastPrintRow).toBeLessThanOrEqual(34);
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

  it('không có dữ liệu vẫn tạo file hợp lệ, số tổng bằng 0 và chart vẫn đủ mốc', async () => {
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
    expect(kpiValue(dash, 'DỰ CHI TRONG KỲ')).toBeUndefined();
    expect(wb.getWorksheet('Báo cáo lợi nhuận')!.getCell('A1').value).toBe(
      'Báo cáo lợi nhuận',
    );
  });
});
