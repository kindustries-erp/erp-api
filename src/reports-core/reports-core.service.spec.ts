import { ReportsCoreService } from './reports-core.service';

describe('ReportsCoreService', () => {
  const dataSource = {
    query: jest.fn(),
  } as any;

  let service: ReportsCoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsCoreService(dataSource);
  });

  it('maps sales dashboard payload from SQL rows', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        { total_orders: '2', total_qty: '1000', completion_rate: '75.5' },
      ])
      .mockResolvedValueOnce([{ status: 'DELIVERED', count: '1' }])
      .mockResolvedValueOnce([{ month: '2026-07', qty: '1000' }])
      .mockResolvedValueOnce([
        {
          customerId: 'c1',
          customerName: 'ACME',
          orders: '2',
          qty: '1000',
        },
      ])
      .mockResolvedValueOnce([{ color: 'ĐỎ', qty: '500', customers: 'ACME' }]);

    const result = await service.getSalesDashboard({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });

    expect(result.kpi.totalOrders).toBe(2);
    expect(result.kpi.totalQty).toBe(1000);
    expect(result.kpi.completionRate).toBe(75.5);
    expect(result.statusBreakdown).toEqual([{ status: 'DELIVERED', count: 1 }]);
    expect(result.trend).toEqual([{ month: '2026-07', qty: 1000 }]);
    expect(result.topCustomers[0].customerName).toBe('ACME');
  });

  it('maps purchasing dashboard payload from SQL rows', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          total_orders: '3',
          total_qty: '2400',
          completion_rate: '60',
        },
      ])
      .mockResolvedValueOnce([{ status: 'CONFIRMED', count: '2' }])
      .mockResolvedValueOnce([{ month: '2026-07', qty: '2400' }])
      .mockResolvedValueOnce([
        {
          supplierId: 's1',
          supplierName: 'Supplier A',
          orders: '3',
          qty: '2400',
        },
      ]);

    const result = await service.getPurchasingDashboard({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });

    expect(result.kpi.totalOrders).toBe(3);
    expect(result.kpi.totalQty).toBe(2400);
    expect(result.kpi.completionRate).toBe(60);
    expect(result.statusBreakdown).toEqual([{ status: 'CONFIRMED', count: 2 }]);
    expect(result.trend).toEqual([{ month: '2026-07', qty: 2400 }]);
    expect(result.topSuppliers[0].supplierName).toBe('Supplier A');
  });

  it('builds VINFAST IN item code SQL with exception and fallback precedence', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await service.getVinfastPartsTracking({ page: 1, limit: 10 });

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('VF5_HV_BATTERY_PACK_38_KWH');
    expect(sql).toContain("'EEP73110011AP'");
    expect(sql).toContain('HV_BATTERY_41.9KWH');
    expect(sql).toContain("'BAT21001011'");
    expect(sql).toContain('HV_BATTERY_PACK');
    expect(sql).toContain("'EEP73110011ALL'");
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[A-Z0-9]+)')",
    );
    expect(sql).toContain("TRIM(SPLIT_PART(ii.description, ' - ', 1))");
  });

  it('keeps exception precedence before regex and fallback in overview SQL', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await service.getVinfastPartsTracking({ page: 1, limit: 10 });

    const sql = dataSource.query.mock.calls[0][0] as string;
    const vf5Idx = sql.indexOf('VF5_HV_BATTERY_PACK_38_KWH');
    const hv419Idx = sql.indexOf('HV_BATTERY_41.9KWH');
    const hvPackIdx = sql.indexOf('HV_BATTERY_PACK');
    const regexIdx = sql.indexOf(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[A-Z0-9]+)')",
    );
    const fallbackIdx = sql.indexOf(
      "TRIM(SPLIT_PART(ii.description, ' - ', 1))",
    );

    expect(vf5Idx).toBeGreaterThan(-1);
    expect(hv419Idx).toBeGreaterThan(-1);
    expect(hvPackIdx).toBeGreaterThan(-1);
    expect(regexIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);

    expect(vf5Idx).toBeLessThan(regexIdx);
    expect(hv419Idx).toBeLessThan(regexIdx);
    expect(hvPackIdx).toBeLessThan(regexIdx);
    expect(regexIdx).toBeLessThan(fallbackIdx);
    expect(vf5Idx).toBeLessThan(hvPackIdx);
  });

  it('applies the same IN detection rules in details SQL', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await service.getVinfastPartsTrackingDetails({});

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain("'IN' as direction");
    expect(sql).toContain('VF5_HV_BATTERY_PACK_38_KWH');
    expect(sql).toContain("'EEP73110011AP'");
    expect(sql).toContain('HV_BATTERY_41.9KWH');
    expect(sql).toContain("'BAT21001011'");
    expect(sql).toContain('HV_BATTERY_PACK');
    expect(sql).toContain("'EEP73110011ALL'");
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[A-Z0-9]+)')",
    );
    expect(sql).toContain("TRIM(SPLIT_PART(ii.description, ' - ', 1))");
    expect(sql).toContain('AND (\n      CASE');
    expect(sql).toContain(') IS NOT NULL');
  });

  it('applies the same IN detection rules in column-options SQL', async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await service.getVinfastPartsColumnOptions({
      columnKey: 'itemCode',
      search: '',
      page: 1,
      limit: 20,
      filtersStr: '{}',
    });

    const sql = dataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('WITH buy_codes AS');
    expect(sql).toContain('VF5_HV_BATTERY_PACK_38_KWH');
    expect(sql).toContain("'EEP73110011AP'");
    expect(sql).toContain('HV_BATTERY_41.9KWH');
    expect(sql).toContain("'BAT21001011'");
    expect(sql).toContain('HV_BATTERY_PACK');
    expect(sql).toContain("'EEP73110011ALL'");
    expect(sql).toContain(
      "SUBSTRING(UPPER(COALESCE(ii.description, '')) FROM '([A-Z]{3}[A-Z0-9]+)')",
    );
    expect(sql).toContain("TRIM(SPLIT_PART(ii.description, ' - ', 1))");
  });
});
