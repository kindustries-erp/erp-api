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
});
