import { GarageCashflowService } from './garage-cashflow.service';
import { GarageCashflowQueryEngine } from './engines/garage-cashflow-query.engine';
import { GarageCashflowDuplicateEngine } from './engines/garage-cashflow-duplicate.engine';
import { GarageCashflowTransactionService } from './garage-cashflow-transaction.service';
import { GarageCashflowDashboardEngine } from './engines/garage-cashflow-dashboard.engine';

describe('GarageCashflowService (Facade)', () => {
  let service: GarageCashflowService;
  let mockQueryEngine: jest.Mocked<Partial<GarageCashflowQueryEngine>>;
  let mockTransactionService: jest.Mocked<
    Partial<GarageCashflowTransactionService>
  >;

  let mockDuplicateEngine: jest.Mocked<Partial<GarageCashflowDuplicateEngine>>;
  let mockDashboardEngine: jest.Mocked<Partial<GarageCashflowDashboardEngine>>;

  beforeEach(() => {
    mockQueryEngine = {
      getDashboardStats: jest.fn().mockResolvedValue({
        totalIn: 100,
        totalOut: 50,
        netAmount: 50,
      } as any),
      getColumnOptions: jest
        .fn()
        .mockResolvedValue({ data: ['option1'], total: 1 }),
      listVouchers: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };

    mockDashboardEngine = {
      getDashboardStats: jest.fn().mockResolvedValue({
        kpi: { totalIn: 100, totalOut: 50, net: 50 },
        trend: [],
      } as any),
    };

    mockTransactionService = {
      createVoucher: jest.fn().mockResolvedValue({ id: 'voucher-1' } as any),
      updateVoucher: jest.fn().mockResolvedValue({ id: 'voucher-1' } as any),
      deleteVoucher: jest.fn().mockResolvedValue({ success: true } as any),
    };

    mockDuplicateEngine = {
      findPotentialDuplicates: jest.fn().mockResolvedValue({ ok: true } as any),
    };

    service = new GarageCashflowService(
      mockQueryEngine as GarageCashflowQueryEngine,
      mockTransactionService as GarageCashflowTransactionService,
      mockDuplicateEngine as GarageCashflowDuplicateEngine,
      mockDashboardEngine as GarageCashflowDashboardEngine,
    );
  });

  it('delegates findPotentialDuplicates to duplicateEngine', async () => {
    const q = { amount: 1000 } as any;
    const res = await service.findPotentialDuplicates(q);
    expect(mockDuplicateEngine.findPotentialDuplicates).toHaveBeenCalledWith(q);
    expect(res).toEqual({ ok: true });
  });

  it('delegates createVoucher to transactionService', async () => {
    const dto = { voucherType: 'RECEIPT', amount: 1000 } as any;
    const user = { sub: 'u-1', email: 'test@liouni.com' };
    const res = await service.createVoucher(dto, user);

    expect(mockTransactionService.createVoucher).toHaveBeenCalledWith(
      dto,
      user,
    );
    expect(res).toEqual({ id: 'voucher-1' });
  });

  it('delegates updateVoucher to transactionService', async () => {
    const dto = { amount: 2000 } as any;
    const user = { sub: 'u-1', email: 'test@liouni.com' };
    const res = await service.updateVoucher('v-1', dto, user);

    expect(mockTransactionService.updateVoucher).toHaveBeenCalledWith(
      'v-1',
      dto,
      user,
    );
    expect(res).toEqual({ id: 'voucher-1' });
  });

  it('delegates deleteVoucher to transactionService', async () => {
    const user = { sub: 'u-1', email: 'test@liouni.com' };
    const res = await service.deleteVoucher('v-1', user);

    expect(mockTransactionService.deleteVoucher).toHaveBeenCalledWith(
      'v-1',
      user,
    );
    expect(res).toEqual({ success: true });
  });

  it('delegates getDashboardStats to dashboardEngine', async () => {
    const query = { dateFrom: '2026-10-01' };
    const res = await service.getDashboardStats(query);

    expect(mockDashboardEngine.getDashboardStats).toHaveBeenCalledWith(query);
    expect(res).toEqual({
      kpi: { totalIn: 100, totalOut: 50, net: 50 },
      trend: [],
    });
  });

  it('delegates getColumnOptions to queryEngine', async () => {
    const res = await service.getColumnOptions(
      'voucherType',
      'REC',
      1,
      10,
      '{}',
    );

    expect(mockQueryEngine.getColumnOptions).toHaveBeenCalledWith(
      'voucherType',
      'REC',
      1,
      10,
      '{}',
    );
    expect(res).toEqual({ data: ['option1'], total: 1 });
  });

  it('delegates listVouchers to queryEngine', async () => {
    const query = { page: 1, pageSize: 20 } as any;
    const res = await service.listVouchers(query);

    expect(mockQueryEngine.listVouchers).toHaveBeenCalledWith(query);
    expect(res).toEqual({ data: [], total: 0 });
  });
});
