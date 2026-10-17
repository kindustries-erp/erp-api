import * as ExcelJS from 'exceljs';

import { GaragePeriodReportService } from './garage-period-report.service';

const customerRow = {
  licensePlate: '30A-111.11',
  partnerCode: 'KH01',
  partnerName: 'Công ty A',
  caseCount: 1,
  totalAmount: 1000,
  paidAmount: 400,
  balanceAmount: 600,
  aging0_30: 0,
  aging31_60: 0,
  aging61_90: 0,
  agingOver90: 600,
  maxAgingDays: 120,
};

describe('GaragePeriodReportService', () => {
  const debtsExport = {
    loadCustomerRows: jest.fn(),
    loadSupplierRows: jest.fn(),
    loadCustomerGroups: jest.fn(),
    resolveBranchLabel: jest.fn(),
  };
  const queries = { loadVouchers: jest.fn(), loadPnlMonthly: jest.fn() };
  const timelines = {
    loadRevenueTimeline: jest.fn(),
    loadDebtTimeline: jest.fn(),
  };
  let service: GaragePeriodReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    debtsExport.loadCustomerRows.mockResolvedValue([customerRow]);
    debtsExport.loadSupplierRows.mockResolvedValue([]);
    debtsExport.loadCustomerGroups.mockResolvedValue({});
    debtsExport.resolveBranchLabel.mockResolvedValue('Chi nhánh Quận 7');
    queries.loadVouchers.mockResolvedValue([]);
    queries.loadPnlMonthly.mockResolvedValue([]);
    timelines.loadRevenueTimeline.mockResolvedValue([]);
    timelines.loadDebtTimeline.mockResolvedValue([]);
    service = new GaragePeriodReportService(
      debtsExport as any,
      queries as any,
      timelines as any,
    );
  });

  it('công nợ trong kỳ dùng đúng kỳ; nợ quá hạn lấy từ mốc ghi nhận, không giới hạn kỳ', async () => {
    await service.exportExcel('CN1', { from: '2026-10-01', to: '2026-10-31' });

    const customerCalls = debtsExport.loadCustomerRows.mock.calls;
    expect(customerCalls).toHaveLength(2);
    expect(customerCalls[0]).toEqual([
      'CN1',
      { mode: 'by-period', from: '2026-10-01', to: '2026-10-31' },
    ]);
    expect(customerCalls[1][0]).toBe('CN1');
    expect(customerCalls[1][1]).toEqual({
      mode: 'by-period',
      from: '2026-07-01',
    });
    expect(customerCalls[1][1].to).toBeUndefined();
    expect(debtsExport.loadSupplierRows).toHaveBeenCalledTimes(2);
  });

  it('truyền kỳ và chi nhánh cho truy vấn thu chi; P&L lấy 12 tháng kết thúc ở tháng chứa ngày kết thúc kỳ', async () => {
    await service.exportExcel('CN1', { from: '2026-09-01', to: '2026-09-30' });

    expect(queries.loadVouchers).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-09-30',
      'CN1',
    );
    expect(queries.loadPnlMonthly).toHaveBeenCalledWith({
      year: 2026,
      month: 9,
    });
    expect(debtsExport.resolveBranchLabel).toHaveBeenCalledWith('CN1');
  });

  it('không có chi nhánh thì không lọc phiếu thu chi theo chi nhánh', async () => {
    await service.exportExcel('', {});
    expect(queries.loadVouchers).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
    );
  });

  it('reportType=business: chỉ truy vấn P&L, không đụng công nợ và thu chi', async () => {
    const buffer = await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'business',
    });

    expect(queries.loadPnlMonthly).toHaveBeenCalledTimes(1);
    expect(queries.loadVouchers).not.toHaveBeenCalled();
    expect(debtsExport.loadCustomerRows).not.toHaveBeenCalled();
    expect(debtsExport.loadSupplierRows).not.toHaveBeenCalled();
    expect(debtsExport.loadCustomerGroups).not.toHaveBeenCalled();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Báo cáo lợi nhuận']);
  });

  it('reportType=overdue: chỉ truy vấn nợ còn mở từ mốc ghi nhận', async () => {
    await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'overdue',
    });

    expect(debtsExport.loadCustomerRows).toHaveBeenCalledTimes(1);
    expect(debtsExport.loadCustomerRows.mock.calls[0][1]).toEqual({
      mode: 'by-period',
      from: '2026-07-01',
    });
    expect(debtsExport.loadCustomerGroups).not.toHaveBeenCalled();
    expect(queries.loadPnlMonthly).not.toHaveBeenCalled();
    expect(queries.loadVouchers).not.toHaveBeenCalled();
  });

  it('reportType=cashflow-debts: không truy vấn P&L', async () => {
    await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'cashflow-debts',
    });

    expect(queries.loadPnlMonthly).not.toHaveBeenCalled();
    expect(queries.loadVouchers).toHaveBeenCalledTimes(1);
    expect(debtsExport.loadCustomerGroups).toHaveBeenCalledTimes(1);
  });

  it('chart theo thời gian: truyền kỳ và chi nhánh, chỉ chạy timeline mà loại báo cáo cần', async () => {
    await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'all',
    });
    expect(timelines.loadRevenueTimeline).toHaveBeenCalledWith(
      '2026-10-01',
      '2026-10-31',
    );
    expect(timelines.loadDebtTimeline).toHaveBeenCalledWith(
      '2026-10-01',
      '2026-10-31',
      'CN1',
    );

    jest.clearAllMocks();
    await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'business',
    });
    expect(timelines.loadRevenueTimeline).toHaveBeenCalledTimes(1);
    expect(timelines.loadDebtTimeline).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'cashflow-debts',
    });
    expect(timelines.loadRevenueTimeline).not.toHaveBeenCalled();
    expect(timelines.loadDebtTimeline).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    await service.exportExcel('CN1', {
      from: '2026-10-01',
      to: '2026-10-31',
      reportType: 'overdue',
    });
    expect(timelines.loadRevenueTimeline).not.toHaveBeenCalled();
    expect(timelines.loadDebtTimeline).not.toHaveBeenCalled();
  });

  it('báo tiến trình tăng dần đến 100 và trả file Excel hợp lệ có Dashboard đầu tiên', async () => {
    const progress = jest.fn();
    const buffer = await service.exportExcel(
      'CN1',
      { from: '2026-10-01', to: '2026-10-31' },
      progress,
    );

    const values = progress.mock.calls.map((c) => c[0]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(progress).toHaveBeenLastCalledWith(100, 100, 'Hoàn tất.');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets[0].name).toBe('Dashboard');
    expect(wb.worksheets.map((w) => w.name)).toContain('Thu chi trong kỳ');
    expect(wb.worksheets.map((w) => w.name)).toContain('Nợ quá hạn cần chú ý');
  });
});
