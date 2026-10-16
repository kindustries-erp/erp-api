import * as ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { GarageDebtsExportService } from './garage-debts-export.service';

const customerRow = {
  licensePlate: '30A-123.45',
  customerCode: 'KH01',
  customerName: 'Nguyễn Văn A',
  branchExternalId: 'CN1',
  caseCount: 2,
  totalAmount: 1000,
  paidAmount: 400,
  balanceAmount: 600,
  latestDate: '2026-07-20T00:00:00.000Z',
  oldestDate: '2026-07-05T00:00:00.000Z',
  maxAgingDays: 12,
  aging0_30: 600,
  aging31_60: 0,
  aging61_90: 0,
  agingOver90: 0,
};

const secondCustomerRow = {
  ...customerRow,
  licensePlate: '51B-999.99',
  customerCode: 'KH02',
  customerName: 'Trần Thị B',
  balanceAmount: 100,
  totalAmount: 300,
  paidAmount: 200,
  caseCount: 1,
  maxAgingDays: 45,
  aging0_30: 0,
  aging31_60: 100,
};

const supplierRow = {
  ...customerRow,
  customerCode: 'NCC9',
  supplierCode: 'NCC9',
  supplierName: 'Phụ tùng B',
  costAmount: 500,
  licensePlate: '',
};

describe('GarageDebtsExportService', () => {
  const customersQuery = { getCustomersDebt: jest.fn() };
  const suppliers = { getSuppliersDebt: jest.fn() };
  const branchRepo = { findOne: jest.fn() };
  let service: GarageDebtsExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    customersQuery.getCustomersDebt.mockResolvedValue({
      data: [customerRow, secondCustomerRow],
    });
    suppliers.getSuppliersDebt.mockResolvedValue({ data: [supplierRow] });
    branchRepo.findOne.mockResolvedValue({
      externalId: 'CN1',
      name: 'Chi nhánh Quận 7',
    });
    service = new GarageDebtsExportService(
      customersQuery as any,
      suppliers as any,
      branchRepo as any,
    );
  });

  const loadWorkbook = async (buffer: Buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    return wb;
  };

  const chartParts = async (buffer: Buffer) => {
    const zip = await JSZip.loadAsync(buffer);
    return Object.keys(zip.files).filter((p) =>
      /^xl\/charts\/chart\d+\.xml$/.test(p),
    );
  };

  it('xuất công nợ khách hàng: Dashboard là sheet đầu, chi tiết ở sheet 2, không phân trang', async () => {
    const progress = jest.fn();
    const buffer = await service.exportExcel(
      'customers',
      'CN1',
      {
        mode: 'by-current-filter',
        from: '2026-07-01',
        q: 'abc',
        sorts: ['-balanceAmount'],
      },
      progress,
    );
    const wb = await loadWorkbook(buffer);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Dashboard',
      'Công nợ phải thu',
    ]);
    const sheet = wb.getWorksheet('Công nợ phải thu')!;
    const header = sheet.getRow(4).values as unknown[];
    expect(header).toContain('Khách hàng');
    expect(header).toContain('Còn phải thu');

    expect(sheet.getRow(5).getCell(1).value).toBe(1);
    expect(sheet.getRow(6).getCell(1).value).toBe(2);
    expect(sheet.getRow(5).getCell(2).value).toBe('30A-123.45');
    expect(sheet.getRow(5).getCell(4).value).toBe('Nguyễn Văn A');

    const balanceIdx = (header as string[]).indexOf('Còn phải thu');
    expect((sheet.getRow(1).getCell(balanceIdx).value as any).result).toBe(700);

    expect(customersQuery.getCustomersDebt).toHaveBeenCalledWith(
      'CN1',
      expect.objectContaining({
        q: 'abc',
        from: '2026-07-01',
        sorts: ['-balanceAmount'],
      }),
      { unpaged: true },
    );
    expect(progress).toHaveBeenLastCalledWith(100, 100, 'Hoàn tất.');
  });

  it('đã bỏ cột Chi nhánh khỏi file công nợ (khách hàng và NCC)', async () => {
    for (const kind of ['customers', 'suppliers'] as const) {
      const wb = await loadWorkbook(await service.exportExcel(kind, 'CN1', {}));
      const sheet = wb.worksheets[1];
      const header = sheet.getRow(4).values as unknown[];
      expect(header).not.toContain('Chi nhánh');
      // STT, Biển số, Mã, Tên, Số phiếu, Tổng, Đã, Còn, 4 tuổi nợ, tuổi nợ max, 2 ngày = 15 cột
      expect(sheet.columnCount).toBe(15);
    }
  });

  it('Dashboard: KPI là công thức khớp tổng sheet chi tiết, có tiêu đề kỳ và tên chi nhánh', async () => {
    const wb = await loadWorkbook(
      await service.exportExcel('customers', 'CN1', {
        mode: 'by-period',
        from: '2026-07-01',
        to: '2026-07-31',
      }),
    );
    const dash = wb.getWorksheet('Dashboard')!;

    expect(dash.getCell('A1').value).toBe(
      'Dashboard công nợ phải thu - Khách hàng',
    );
    expect(dash.getCell('A2').value).toBe('Kỳ: 01/07/2026 - 31/07/2026');
    expect(dash.getCell('A3').value).toBe('Chi nhánh: Chi nhánh Quận 7');
    expect(dash.getCell('A4').value).toBe('Chế độ: Theo kỳ');

    // Hàng KPI 1 (nhãn dòng 6, giá trị dòng 7): Tổng, Đã thu, Còn, Tỷ lệ
    const value = (addr: string) => dash.getCell(addr).value as any;
    expect(value('A7')).toMatchObject({
      formula: "SUM('Công nợ phải thu'!F5:F6)",
      result: 1300,
    });
    expect(value('E7')).toMatchObject({
      formula: "SUM('Công nợ phải thu'!G5:G6)",
      result: 600,
    });
    expect(value('I7')).toMatchObject({
      formula: "SUM('Công nợ phải thu'!H5:H6)",
      result: 700,
    });
    expect(value('M7').result).toBeCloseTo(600 / 1300, 6);
    // Hàng KPI 2: số xe, số phiếu, nợ >90, tuổi nợ lớn nhất
    expect(value('A10')).toBe(2);
    expect(value('E10')).toMatchObject({ result: 3 });
    expect(value('M10')).toMatchObject({
      formula: "MAX('Công nợ phải thu'!M5:M6)",
      result: 45,
    });
  });

  it('Dashboard có 3 chart gốc (tuổi nợ, top còn nợ, đã thu vs còn lại) tham chiếu đúng ô', async () => {
    const buffer = await service.exportExcel('customers', 'CN1', {});
    const parts = await chartParts(buffer);
    expect(parts).toHaveLength(3);

    const zip = await JSZip.loadAsync(buffer);
    const xmls = await Promise.all(
      parts.map((p) => zip.file(p)!.async('string')),
    );
    expect(xmls.some((x) => x.includes('<c:doughnutChart>'))).toBe(true);
    expect(xmls.some((x) => x.includes('<c:barDir val="bar"/>'))).toBe(true);
    expect(xmls.some((x) => x.includes('<c:barDir val="col"/>'))).toBe(true);

    // Top 10 sắp theo còn nợ giảm dần: dòng 600 trước dòng 100
    const wb = await loadWorkbook(buffer);
    const dash = wb.getWorksheet('Dashboard')!;
    const topLabelCells = [] as unknown[];
    dash.eachRow((row) => {
      const v = row.getCell(21).value;
      if (typeof v === 'string' && typeof row.getCell(22).value === 'number')
        topLabelCells.push(v);
    });
    expect(topLabelCells).toEqual([
      '30A-123.45 - Nguyễn Văn A',
      '51B-999.99 - Trần Thị B',
    ]);
  });

  it('chế độ theo kỳ bỏ filter/sort của bảng', async () => {
    await service.exportExcel('customers', 'CN1', {
      mode: 'by-period',
      from: '2026-07-01',
      to: '2026-07-31',
      q: 'bị bỏ',
      filtersStr: '{"customer":["x"]}',
      sorts: ['-balanceAmount'],
    });

    const params = customersQuery.getCustomersDebt.mock.calls[0][1];
    expect(params).toMatchObject({ from: '2026-07-01', to: '2026-07-31' });
    expect(params.q).toBeUndefined();
    expect(params.filtersStr).toBeUndefined();
    expect(params.sorts).toBeUndefined();
  });

  it('xuất công nợ NCC với header NCC, lấy toàn bộ dòng', async () => {
    const wb = await loadWorkbook(
      await service.exportExcel('suppliers', 'CN1', {
        mode: 'by-current-filter',
      }),
    );

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Dashboard',
      'Công nợ phải trả',
    ]);
    const sheet = wb.getWorksheet('Công nợ phải trả')!;
    const header = sheet.getRow(4).values as unknown[];
    expect(header).toContain('Nhà cung cấp');
    expect(header).toContain('Còn phải trả');
    expect(header).not.toContain('Khách hàng');
    expect(sheet.getRow(5).getCell(3).value).toBe('NCC9');
    expect(sheet.getRow(5).getCell(4).value).toBe('Phụ tùng B');
    expect(wb.getWorksheet('Dashboard')!.getCell('A1').value).toBe(
      'Dashboard công nợ phải trả - Nhà cung cấp',
    );

    expect(suppliers.getSuppliersDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'CN1',
        page: '1',
        pageSize: '1000000',
      }),
    );
  });

  it('không có dữ liệu vẫn tạo file hợp lệ, Dashboard chỉ còn chart tuổi nợ', async () => {
    customersQuery.getCustomersDebt.mockResolvedValue({ data: [] });
    const buffer = await service.exportExcel('customers', '', {});
    const wb = await loadWorkbook(buffer);

    expect(wb.worksheets[1].getRow(4).getCell(1).value).toBe('STT');
    expect(wb.getWorksheet('Dashboard')!.getCell('A3').value).toBe(
      'Chi nhánh: Tất cả chi nhánh',
    );
    expect(await chartParts(buffer)).toHaveLength(1);
  });

  it('tên chi nhánh lỗi tra cứu thì dùng mã chi nhánh', async () => {
    branchRepo.findOne.mockRejectedValue(new Error('db down'));
    const wb = await loadWorkbook(
      await service.exportExcel('customers', 'CN9', {}),
    );
    expect(wb.getWorksheet('Dashboard')!.getCell('A3').value).toBe(
      'Chi nhánh: CN9',
    );
  });
});
