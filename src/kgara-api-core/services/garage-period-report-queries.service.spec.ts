import { GaragePeriodReportQueries } from './garage-period-report-queries.service';

const makeQb = (rows: unknown[]) => {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return qb;
};

describe('GaragePeriodReportQueries', () => {
  const pnl = { getPnlReport: jest.fn() };

  const build = (rows: unknown[]) => {
    const qb = makeQb(rows);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = new GaragePeriodReportQueries(repo as any, pnl as any);
    return { qb, service };
  };

  beforeEach(() => jest.clearAllMocks());

  it('lọc phiếu theo trans_date trong kỳ (bỏ phần giờ) và sắp tăng dần', async () => {
    const { qb, service } = build([]);
    await service.loadVouchers('2026-10-01', '2026-10-31T23:59:59');

    expect(qb.andWhere).toHaveBeenCalledWith('voucher.transDate >= :dayFrom', {
      dayFrom: '2026-10-01',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('voucher.transDate <= :dayTo', {
      dayTo: '2026-10-31',
    });
    expect(qb.orderBy).toHaveBeenCalledWith('voucher.transDate', 'ASC');
  });

  it('có chi nhánh thì giữ phiếu không gắn phiếu dịch vụ và phiếu đúng chi nhánh', async () => {
    const { qb, service } = build([]);
    await service.loadVouchers(undefined, undefined, 'CN1');

    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    expect(qb.andWhere.mock.calls[0][0]).toContain('voucher.caseId IS NULL');
    expect(qb.andWhere.mock.calls[0][1]).toEqual({ branchId: 'CN1' });
  });

  it('chuẩn hóa dòng phiếu: loại, biển số lấy từ phiếu dịch vụ khi phiếu trống, số tiền là số', async () => {
    const { service } = build([
      {
        voucherCode: 'PT001',
        voucherType: 'RECEIPT',
        transDate: '2026-10-05',
        amount: '1500000.00',
        licensePlate: null,
        case: { bienSoXe: '30A-111.11', soChungTu: 'GR-PDV2610-0001' },
        partnerName: 'Công ty A',
        paymentContent: '1. KH thanh toán',
        paymentMethod: 'CASH',
        note: null,
      },
      {
        voucherCode: 'PC001',
        voucherType: 'PAYMENT',
        transDate: '2026-10-06',
        amount: 200000,
        licensePlate: '51K-222.22',
      },
    ]);

    const rows = await service.loadVouchers();
    expect(rows[0]).toMatchObject({
      type: 'RECEIPT',
      amount: 1500000,
      licensePlate: '30A-111.11',
      soChungTu: 'GR-PDV2610-0001',
      note: '',
    });
    expect(rows[1]).toMatchObject({
      type: 'PAYMENT',
      licensePlate: '51K-222.22',
      paymentContent: '',
      partnerName: '',
    });
  });

  it('P&L theo tháng: 12 tháng cũ đến mới, gọi đúng từng tháng', async () => {
    pnl.getPnlReport.mockImplementation(
      async (year: number, month: number) => ({
        revenue: year * 100 + month,
        cogs: 1,
        grossProfit: 2,
        opex: { total: 3, items: [] },
        commission: { total: 0, items: [] },
      }),
    );
    const { service } = build([]);

    const rows = await service.loadPnlMonthly({ year: 2026, month: 7 });

    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ year: 2025, month: 8, revenue: 202508 });
    expect(rows[11]).toMatchObject({ year: 2026, month: 7, revenue: 202607 });
    expect(pnl.getPnlReport).toHaveBeenCalledTimes(12);
    expect(pnl.getPnlReport).toHaveBeenNthCalledWith(1, 2025, 8);
    expect(pnl.getPnlReport).toHaveBeenLastCalledWith(2026, 7);
  });

  it('giới hạn 3 yêu cầu P&L song song', async () => {
    let running = 0;
    let peak = 0;
    pnl.getPnlReport.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setImmediate(resolve));
      running -= 1;
      return {};
    });
    const { service } = build([]);

    await service.loadPnlMonthly({ year: 2026, month: 7 });
    expect(peak).toBe(3);
  });

  it('một tháng lỗi thì cả báo cáo lỗi, không ghi số 0 thay thế', async () => {
    pnl.getPnlReport.mockRejectedValue(new Error('db down'));
    const { service } = build([]);
    await expect(
      service.loadPnlMonthly({ year: 2026, month: 7 }, 2),
    ).rejects.toThrow('db down');
  });
});
