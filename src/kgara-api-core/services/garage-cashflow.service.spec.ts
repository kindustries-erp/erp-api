import { GarageCashflowService } from './garage-cashflow.service';
import { GarageCashflowQueryEngine } from './engines/garage-cashflow-query.engine';
import { GarageCashflowTransactionService } from './garage-cashflow-transaction.service';

describe('GarageCashflowService (Facade)', () => {
  let service: GarageCashflowService;
  let mockQueryEngine: jest.Mocked<Partial<GarageCashflowQueryEngine>>;
  let mockTransactionService: jest.Mocked<
    Partial<GarageCashflowTransactionService>
  >;

  beforeEach(() => {
    mockQueryEngine = {
      getDashboardStats: jest
        .fn()
        .mockResolvedValue({ totalIn: 100, totalOut: 50, netAmount: 50 }),
      getColumnOptions: jest
        .fn()
        .mockResolvedValue({ data: ['option1'], total: 1 }),
      listVouchers: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };

    mockTransactionService = {
      createVoucher: jest.fn().mockResolvedValue({ id: 'voucher-1' } as any),
      updateVoucher: jest.fn().mockResolvedValue({ id: 'voucher-1' } as any),
      deleteVoucher: jest.fn().mockResolvedValue({ success: true } as any),
    };

    service = new GarageCashflowService(
      mockQueryEngine as GarageCashflowQueryEngine,
      mockTransactionService as GarageCashflowTransactionService,
    );
  });

  it('delegates createVoucher to transactionService', async () => {
    const dto = { voucherType: 'RECEIPT', amount: 1000 } as any;
    const res = await service.createVoucher(dto);

    expect(mockTransactionService.createVoucher).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ id: 'voucher-1' });
  });

  it('delegates updateVoucher to transactionService', async () => {
    const dto = { amount: 2000 } as any;
    const res = await service.updateVoucher('v-1', dto);

    expect(mockTransactionService.updateVoucher).toHaveBeenCalledWith(
      'v-1',
      dto,
    );
    expect(res).toEqual({ id: 'voucher-1' });
  });

  it('delegates deleteVoucher to transactionService', async () => {
    const res = await service.deleteVoucher('v-1');

    expect(mockTransactionService.deleteVoucher).toHaveBeenCalledWith('v-1');
    expect(res).toEqual({ success: true });
  });

  it('delegates getDashboardStats to queryEngine', async () => {
    const res = await service.getDashboardStats();

    expect(mockQueryEngine.getDashboardStats).toHaveBeenCalled();
    expect(res).toEqual({ totalIn: 100, totalOut: 50, netAmount: 50 });
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
