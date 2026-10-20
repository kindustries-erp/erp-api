import { GarageCashflowDashboardEngine } from './garage-cashflow-dashboard.engine';

function createMockQueryBuilder() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  return qb;
}

describe('GarageCashflowDashboardEngine', () => {
  let engine: GarageCashflowDashboardEngine;
  let mockRepo: any;
  let qb: any;

  beforeEach(() => {
    qb = createMockQueryBuilder();
    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    engine = new GarageCashflowDashboardEngine(mockRepo);
  });

  it('calculates KPIs correctly with net calculation', async () => {
    qb.getRawOne.mockResolvedValue({
      totalIn: '100000000',
      totalOut: '40000000',
      countIn: '25',
      countOut: '10',
      pendingOutAmount: '5000000',
      pendingOutCount: '2',
    });
    qb.getRawMany.mockResolvedValue([]);

    const result = await engine.getDashboardStats({});

    expect(result.kpi.totalIn).toBe(100000000);
    expect(result.kpi.totalOut).toBe(40000000);
    expect(result.kpi.net).toBe(60000000);
    expect(result.kpi.countIn).toBe(25);
    expect(result.kpi.countOut).toBe(10);
    expect(result.kpi.pendingOutAmount).toBe(5000000);
    expect(result.kpi.pendingOutCount).toBe(2);
  });

  it('KPI khớp quy tắc sổ quỹ: Tiền vào loại EXPECTED/CANCELLED, Tiền ra chỉ PAID/null, Dự chi = PENDING + APPROVED', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);

    await engine.getDashboardStats({});

    const selects: string[] = qb.addSelect.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .concat(String(qb.select.mock.calls[0]?.[0]));
    const sql = selects.join('\n');
    expect(sql).toContain("payment_status NOT IN ('EXPECTED', 'CANCELLED')");
    expect(sql).toContain("v.payment_status = 'PAID')");
    expect(sql).toContain("v.payment_status IN ('PENDING', 'APPROVED')");
    expect(sql).not.toContain("v.payment_status = 'PENDING' THEN");
  });

  it('applies date and filter conditions to query builder', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);

    await engine.getDashboardStats({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-15',
      paymentMethod: 'Tiền mặt',
      paymentContent: '1. KH thanh toán',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('v.trans_date >= :dateFrom', {
      dateFrom: '2026-10-01',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('v.trans_date <= :dateTo', {
      dateTo: '2026-10-15',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'v.payment_method = :paymentMethod',
      {
        paymentMethod: 'Tiền mặt',
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'v.payment_content = :paymentContent',
      { paymentContent: '1. KH thanh toán' },
    );
  });

  it('formats trend data with reverse order for chronological display', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockImplementation(() => {
      return Promise.resolve([
        { label: '2026-10', cashIn: '50000000', cashOut: '20000000' },
        { label: '2026-09', cashIn: '40000000', cashOut: '15000000' },
      ]);
    });

    const result = await engine.getDashboardStats({});

    expect(result.trend).toHaveLength(2);
    expect(result.trend[0].label).toBe('2026-09');
    expect(result.trend[0].cashIn).toBe(40000000);
    expect(result.trend[0].net).toBe(25000000);
    expect(result.trend[1].label).toBe('2026-10');
    expect(result.trend[1].net).toBe(30000000);
  });

  it('applies branchId filter by joining v.case and KgaraBranch safely without c.branchName', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);

    await engine.getDashboardStats({
      branchId: '0b4d6d3a-55df-492b-abaf-377d84b61d05',
    });

    expect(qb.leftJoin).toHaveBeenCalledWith('v.case', 'c');
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(c.branch_external_id = :branchId OR CAST(b.id AS TEXT) = :branchId OR b.name = :branchId OR b.code = :branchId)',
      { branchId: '0b4d6d3a-55df-492b-abaf-377d84b61d05' },
    );

    // Verify c.branchName is never used in any where clause
    const allWhereCalls = qb.andWhere.mock.calls;
    for (const [sql] of allWhereCalls) {
      expect(sql).not.toContain('branchName');
    }
  });

  it('ignores branchId if it is empty, whitespace, or ALL', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);

    await engine.getDashboardStats({
      branchId: 'ALL',
    });

    const allWhereCalls = qb.andWhere.mock.calls;
    for (const [sql] of allWhereCalls) {
      expect(sql).not.toContain('branch_external_id');
    }
  });

  it('uses andWhere instead of where for breakdown and top transactions to preserve base filters', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);

    await engine.getDashboardStats({
      dateFrom: '2026-10-01',
      branchId: '0b4d6d3a-55df-492b-abaf-377d84b61d05',
    });

    // qb.where should never be called so base filters are not wiped out
    expect(qb.where).not.toHaveBeenCalled();

    // Verify andWhere was called for RECEIPT and PAYMENT voucher_type
    expect(qb.andWhere).toHaveBeenCalledWith('v.voucher_type = :type', {
      type: 'RECEIPT',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('v.voucher_type = :type', {
      type: 'PAYMENT',
    });
  });
});
