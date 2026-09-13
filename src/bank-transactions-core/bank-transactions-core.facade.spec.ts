import { BankTransactionsCoreService } from './bank-transactions-core.service';

describe('BankTransactionsCoreService facade delegation', () => {
  let service: BankTransactionsCoreService;

  let bankAccountLifecycleService: any;
  let cashBookLifecycleService: any;
  let balanceStatementLifecycleService: any;
  let transactionImportService: any;
  let transactionQueryService: any;
  let transactionAnalyticsService: any;
  let transactionAccountingService: any;

  beforeEach(() => {
    bankAccountLifecycleService = {
      getBankAccounts: jest.fn(),
      createBankAccount: jest.fn(),
      updateBankAccount: jest.fn(),
      deleteBankAccount: jest.fn(),
    };

    cashBookLifecycleService = {
      getCashBooks: jest.fn(),
      createCashBook: jest.fn(),
      updateCashBook: jest.fn(),
      deleteCashBook: jest.fn(),
    };

    balanceStatementLifecycleService = {
      getBankAccountBalances: jest.fn(),
      createBankAccountBalance: jest.fn(),
      updateBankAccountBalance: jest.fn(),
      deleteBankAccountBalance: jest.fn(),
      getCashBookBalances: jest.fn(),
      createCashBookBalance: jest.fn(),
      updateCashBookBalance: jest.fn(),
      deleteCashBookBalance: jest.fn(),
      getStatementFiles: jest.fn(),
      createStatementFile: jest.fn(),
      deleteStatementFile: jest.fn(),
    };

    transactionImportService = {
      importFiles: jest.fn(),
      rollbackBatch: jest.fn(),
    };

    transactionQueryService = {
      getTransaction: jest.fn(),
      getTransactions: jest.fn(),
      getColumnOptions: jest.fn(),
    };

    transactionAnalyticsService = {
      getPartnerStats: jest.fn(),
      getDashboardStats: jest.fn(),
    };

    transactionAccountingService = {
      getTransactionPosting: jest.fn(),
      postTransaction: jest.fn(),
      unpostTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      refreshJournalEntriesForBankTransaction: jest.fn(),
      createManualTransaction: jest.fn(),
    };

    service = new BankTransactionsCoreService(
      bankAccountLifecycleService,
      cashBookLifecycleService,
      balanceStatementLifecycleService,
      transactionImportService,
      transactionQueryService,
      transactionAnalyticsService,
      transactionAccountingService,
      {} as any,
    );
  });

  it('delegates getTransactions to query service', async () => {
    const filter: any = { page: 2, pageSize: 10, sourceType: 'BANK' };
    const expected = { items: [{ id: 't1' }], total: 1 };
    transactionQueryService.getTransactions.mockResolvedValue(expected);

    const result = await service.getTransactions(filter);

    expect(transactionQueryService.getTransactions).toHaveBeenCalledWith(
      filter,
    );
    expect(result).toBe(expected);
  });

  it('delegates getColumnOptions to query service', async () => {
    const expected = { items: [{ value: 'v', label: 'l' }], total: 1 };
    transactionQueryService.getColumnOptions.mockResolvedValue(expected);

    const result = await service.getColumnOptions(
      'account',
      'tc',
      1,
      20,
      '{"branch":["b1"]}',
      'BANK',
    );

    expect(transactionQueryService.getColumnOptions).toHaveBeenCalledWith(
      'account',
      'tc',
      1,
      20,
      '{"branch":["b1"]}',
      'BANK',
    );
    expect(result).toBe(expected);
  });

  it('delegates partner and dashboard stats to analytics service', async () => {
    const filter: any = { startDate: '2026-01-01', endDate: '2026-01-31' };
    const partnerExpected = { items: [], total: 0 };
    const dashboardExpected = { totalCashIn: 100, totalCashOut: 50 };

    transactionAnalyticsService.getPartnerStats.mockResolvedValue(
      partnerExpected,
    );
    transactionAnalyticsService.getDashboardStats.mockResolvedValue(
      dashboardExpected,
    );

    const partner = await service.getPartnerStats(filter);
    const dashboard = await service.getDashboardStats(filter);

    expect(transactionAnalyticsService.getPartnerStats).toHaveBeenCalledWith(
      filter,
    );
    expect(transactionAnalyticsService.getDashboardStats).toHaveBeenCalledWith(
      filter,
    );
    expect(partner).toBe(partnerExpected);
    expect(dashboard).toBe(dashboardExpected);
  });

  it('delegates posting workflow methods to accounting service', async () => {
    transactionAccountingService.getTransactionPosting.mockResolvedValue({
      postingStatus: 'POSTED',
    });
    transactionAccountingService.postTransaction.mockResolvedValue({
      postingStatus: 'POSTED',
    });
    transactionAccountingService.unpostTransaction.mockResolvedValue({
      postingStatus: 'UNPOSTED',
    });
    transactionAccountingService.updateTransaction.mockResolvedValue({
      id: 'txn-1',
    });
    transactionAccountingService.refreshJournalEntriesForBankTransaction.mockResolvedValue(
      undefined,
    );

    await service.getTransactionPosting('txn-1');
    await service.postTransaction('txn-1', { lines: [] } as any);
    await service.unpostTransaction('txn-1');
    await service.updateTransaction('txn-1', {} as any);
    await service.refreshJournalEntriesForBankTransaction('txn-1');

    expect(
      transactionAccountingService.getTransactionPosting,
    ).toHaveBeenCalledWith('txn-1');
    expect(transactionAccountingService.postTransaction).toHaveBeenCalledWith(
      'txn-1',
      { lines: [] },
    );
    expect(transactionAccountingService.unpostTransaction).toHaveBeenCalledWith(
      'txn-1',
    );
    expect(transactionAccountingService.updateTransaction).toHaveBeenCalledWith(
      'txn-1',
      {},
    );
    expect(
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
  });

  it('delegates import and rollback to import service', async () => {
    const files = [{ originalname: 'a.xlsx' }] as any;
    const expectedImport = { success: true, count: 1 };
    const expectedRollback = { success: true, rolledBackCount: 1 };

    transactionImportService.importFiles.mockResolvedValue(expectedImport);
    transactionImportService.rollbackBatch.mockResolvedValue(expectedRollback);

    const importRes = await service.importFiles(files, 'branch-1', 'bank-1');
    const rollbackRes = await service.rollbackBatch('batch-1');

    expect(transactionImportService.importFiles).toHaveBeenCalledWith(
      files,
      'branch-1',
      'bank-1',
      undefined,
    );
    expect(transactionImportService.rollbackBatch).toHaveBeenCalledWith(
      'batch-1',
    );
    expect(importRes).toBe(expectedImport);
    expect(rollbackRes).toBe(expectedRollback);
  });

  it('delegates getTransaction to query service', async () => {
    const expected = {
      id: 'txn-1',
      netOffAmount: '30',
      postingStatus: 'POSTED',
    };
    transactionQueryService.getTransaction.mockResolvedValue(expected);

    const result = await service.getTransaction('txn-1');

    expect(transactionQueryService.getTransaction).toHaveBeenCalledWith(
      'txn-1',
    );
    expect(result).toBe(expected);
  });

  it('delegates createManualTransaction to accounting service', async () => {
    const dto: any = {
      sourceType: 'BANK',
      branchId: 'branch-1',
      bankAccountId: 'bank-1',
      transDate: '2026-08-09',
      debitAmount: 0,
      creditAmount: 100,
    };
    const expected = { id: 'txn-manual-1' };
    transactionAccountingService.createManualTransaction.mockResolvedValue(
      expected,
    );

    const result = await service.createManualTransaction(dto);

    expect(
      transactionAccountingService.createManualTransaction,
    ).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('propagates getTransaction errors from query service', async () => {
    const error = new Error('Transaction missing');
    transactionQueryService.getTransaction.mockRejectedValue(error);

    await expect(service.getTransaction('missing')).rejects.toBe(error);
    expect(transactionQueryService.getTransaction).toHaveBeenCalledWith(
      'missing',
    );
  });
});
