import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { CoreRbacGuard } from '../src/auth/guards/core-rbac.guard';
import { BankTransactionsCoreService } from '../src/bank-transactions-core/bank-transactions-core.service';

describe('BankTransactionsCoreController (e2e)', () => {
  let app: INestApplication<App>;

  const bankTransactionsCoreServiceMock = {
    getBankAccounts: jest.fn(),
    getCashBooks: jest.fn(),
    getColumnOptions: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionPosting: jest.fn(),
    getTransactions: jest.fn(),
    getDashboardStats: jest.fn(),
    getPartnerStats: jest.fn(),
    createManualTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    postTransaction: jest.fn(),
    unpostTransaction: jest.fn(),
    importFiles: jest.fn(),
    rollbackBatch: jest.fn(),
    getBankAccountBalances: jest.fn(),
    getCashBookBalances: jest.fn(),
    getStatementFiles: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(BankTransactionsCoreService)
      .useValue(bankTransactionsCoreServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('GET /bank-transactions-core/bank-accounts maps query params to lifecycle service', async () => {
    const responseData = [{ id: 'ba-1' }];
    bankTransactionsCoreServiceMock.getBankAccounts.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/bank-accounts')
      .query({
        branchId: 'branch-1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
      .expect(200)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.getBankAccounts,
    ).toHaveBeenCalledWith('branch-1', '2026-01-01', '2026-01-31');
  });

  it('GET /bank-transactions-core/cash-books maps query params to lifecycle service', async () => {
    const responseData = [{ id: 'cb-1' }];
    bankTransactionsCoreServiceMock.getCashBooks.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/cash-books')
      .query({
        branchId: 'branch-2',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      })
      .expect(200)
      .expect(responseData);

    expect(bankTransactionsCoreServiceMock.getCashBooks).toHaveBeenCalledWith(
      'branch-2',
      '2026-02-01',
      '2026-02-28',
    );
  });

  it('GET /bank-transactions-core/transactions/column-options converts page params to numbers', async () => {
    const responseData = { options: [] };
    bankTransactionsCoreServiceMock.getColumnOptions.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/transactions/column-options')
      .query({
        column: 'description',
        search: 'fuel',
        page: '3',
        pageSize: '15',
        sourceType: 'BANK',
      })
      .expect(200)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.getColumnOptions,
    ).toHaveBeenCalledWith('description', 'fuel', 3, 15, undefined, 'BANK');
  });

  it('GET /bank-transactions-core/transactions/:id delegates to query service flow', async () => {
    const responseData = { id: 'txn-1' };
    bankTransactionsCoreServiceMock.getTransaction.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/transactions/txn-1')
      .expect(200)
      .expect(responseData);

    expect(bankTransactionsCoreServiceMock.getTransaction).toHaveBeenCalledWith(
      'txn-1',
    );
  });

  it('POST /bank-transactions-core/transactions/manual delegates to accounting service flow', async () => {
    const dto = {
      branchId: 'branch-1',
      sourceType: 'BANK',
      amount: 100000,
      transactionDate: '2026-03-01',
    };
    const responseData = { id: 'txn-manual-1' };
    bankTransactionsCoreServiceMock.createManualTransaction.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .post('/bank-transactions-core/transactions/manual')
      .send(dto)
      .expect(201)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.createManualTransaction,
    ).toHaveBeenCalledWith(dto);
  });

  it('POST /bank-transactions-core/transactions/:id/post delegates posting flow', async () => {
    const dto = { accountCode: '111', description: 'Posting entry' };
    const responseData = { success: true };
    bankTransactionsCoreServiceMock.postTransaction.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .post('/bank-transactions-core/transactions/txn-2/post')
      .send(dto)
      .expect(201)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.postTransaction,
    ).toHaveBeenCalledWith('txn-2', dto);
  });

  it('POST /bank-transactions-core/transactions/import validates and delegates import flow', async () => {
    const responseData = { imported: 1 };
    bankTransactionsCoreServiceMock.importFiles.mockResolvedValue(responseData);

    await request(app.getHttpServer())
      .post('/bank-transactions-core/transactions/import')
      .field('branchId', 'branch-3')
      .attach('files', Buffer.from('date,amount\n2026-01-01,100'), 'bank.csv')
      .expect(201)
      .expect(responseData);

    expect(bankTransactionsCoreServiceMock.importFiles).toHaveBeenCalledTimes(
      1,
    );
    const [filesArg, branchIdArg, bankAccountIdArg, cashBookIdArg] =
      bankTransactionsCoreServiceMock.importFiles.mock.calls[0];
    expect(Array.isArray(filesArg)).toBe(true);
    expect(filesArg).toHaveLength(1);
    expect(branchIdArg).toBe('branch-3');
    expect(bankAccountIdArg).toBeUndefined();
    expect(cashBookIdArg).toBeUndefined();
  });

  it('POST /bank-transactions-core/transactions/import returns 400 when branchId is missing', async () => {
    await request(app.getHttpServer())
      .post('/bank-transactions-core/transactions/import')
      .attach('files', Buffer.from('date,amount\n2026-01-01,100'), 'bank.csv')
      .expect(400);

    expect(bankTransactionsCoreServiceMock.importFiles).not.toHaveBeenCalled();
  });

  it('DELETE /bank-transactions-core/transactions/batch/:batchId delegates rollback flow', async () => {
    const responseData = { deleted: 3 };
    bankTransactionsCoreServiceMock.rollbackBatch.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .delete('/bank-transactions-core/transactions/batch/batch-1')
      .expect(200)
      .expect(responseData);

    expect(bankTransactionsCoreServiceMock.rollbackBatch).toHaveBeenCalledWith(
      'batch-1',
    );
  });

  it('GET /bank-transactions-core/dashboard-stats delegates analytics flow', async () => {
    const responseData = { total: 10 };
    bankTransactionsCoreServiceMock.getDashboardStats.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/dashboard-stats')
      .query({ branchId: 'branch-1', sourceType: 'BANK' })
      .expect(200)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.getDashboardStats,
    ).toHaveBeenCalled();
  });

  it('GET /bank-transactions-core/partner-stats delegates analytics flow', async () => {
    const responseData = { rows: [] };
    bankTransactionsCoreServiceMock.getPartnerStats.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/partner-stats')
      .query({ branchId: 'branch-1', sourceType: 'CASH' })
      .expect(200)
      .expect(responseData);

    expect(bankTransactionsCoreServiceMock.getPartnerStats).toHaveBeenCalled();
  });

  it('GET /bank-transactions-core/bank-account-balances validates required query', async () => {
    await request(app.getHttpServer())
      .get('/bank-transactions-core/bank-account-balances')
      .expect(400);

    expect(
      bankTransactionsCoreServiceMock.getBankAccountBalances,
    ).not.toHaveBeenCalled();
  });

  it('GET /bank-transactions-core/bank-account-balances delegates balance flow when valid', async () => {
    const responseData = [{ id: 'bal-1' }];
    bankTransactionsCoreServiceMock.getBankAccountBalances.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/bank-account-balances')
      .query({ bankAccountId: 'bank-1' })
      .expect(200)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.getBankAccountBalances,
    ).toHaveBeenCalledWith('bank-1');
  });

  it('GET /bank-transactions-core/statement-files converts pagination and delegates statement flow', async () => {
    const responseData = { data: [], total: 0 };
    bankTransactionsCoreServiceMock.getStatementFiles.mockResolvedValue(
      responseData,
    );

    await request(app.getHttpServer())
      .get('/bank-transactions-core/statement-files')
      .query({ page: '2', pageSize: '50', branchId: 'branch-1' })
      .expect(200)
      .expect(responseData);

    expect(
      bankTransactionsCoreServiceMock.getStatementFiles,
    ).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      branchId: 'branch-1',
      bankAccountId: undefined,
      cashBookId: undefined,
    });
  });
});
