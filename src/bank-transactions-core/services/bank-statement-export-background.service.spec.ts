import { BankStatementExportBackgroundService } from './bank-statement-export-background.service';

describe('BankStatementExportBackgroundService - Column Filter Integration', () => {
  let service: BankStatementExportBackgroundService;
  let qbMock: any;
  let transactionRepoMock: any;
  let bankAccountRepoMock: any;
  let cashBookRepoMock: any;
  let transactionQueryServiceMock: any;

  beforeEach(() => {
    qbMock = {
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'txn-1',
          transDate: new Date('2026-09-30T10:00:00Z'),
          description: 'TT POS VinFast',
          referenceNumber: 'REF001',
          creditAmount: '2565000',
          debitAmount: '0',
          balance: '34190355',
          bankAccount: {
            bankName: 'Techcombank',
            accountNumber: '111888',
          },
          branch: {
            name: 'Chi nhánh Nam Sài Gòn',
          },
          invoiceNetOffs: [],
        },
      ]),
    };

    const managerMock = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    transactionRepoMock = {
      manager: managerMock,
    };

    bankAccountRepoMock = {
      findOne: jest.fn().mockResolvedValue({
        id: 'acc-1',
        accountNumber: '111888',
      }),
    };

    cashBookRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    transactionQueryServiceMock = {
      buildTransactionQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    service = new BankStatementExportBackgroundService(
      transactionRepoMock as any,
      bankAccountRepoMock as any,
      cashBookRepoMock as any,
      transactionQueryServiceMock as any,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('delegates query construction to TransactionQueryService including column_filters and column_search', async () => {
    const filterDto = {
      sourceType: 'BANK' as const,
      column_filters: JSON.stringify({
        description: ['__ALL_MATCHING__', 'pos'],
      }),
      column_search: JSON.stringify({ description: 'pos' }),
    };

    const result = await service.startBackgroundExport(
      filterDto as any,
      'user-1',
    );

    expect(result.jobId).toBeDefined();
    expect(result.reused).toBe(false);

    // Wait a brief tick for background job execution to invoke buildTransactionQueryBuilder
    await new Promise((r) => setTimeout(r, 50));

    expect(
      transactionQueryServiceMock.buildTransactionQueryBuilder,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'BANK',
        column_filters: JSON.stringify({
          description: ['__ALL_MATCHING__', 'pos'],
        }),
        column_search: JSON.stringify({ description: 'pos' }),
      }),
    );
    expect(qbMock.getMany).toHaveBeenCalled();
  });

  it('generates distinct query fingerprints when column_filters or column_search differ', () => {
    const query1 = {
      sourceType: 'BANK' as const,
      column_filters: '{"description":["pos"]}',
    };
    const query2 = {
      sourceType: 'BANK' as const,
      column_filters: '{"description":["vinfast"]}',
    };

    const fp1 = (service as any).buildQueryFingerprint(query1);
    const fp2 = (service as any).buildQueryFingerprint(query2);

    expect(fp1).not.toBe(fp2);
    expect(fp1).toContain('pos');
    expect(fp2).toContain('vinfast');
  });
});
