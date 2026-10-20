import { TransactionQueryService } from './transaction-query.service';

describe('TransactionQueryService - Server-side Sorting', () => {
  let service: TransactionQueryService;
  let qbMock: any;
  let totalsQbMock: any;
  let transactionRepoMock: any;
  let transactionAccountingServiceMock: any;

  beforeEach(() => {
    totalsQbMock = {
      expressionMap: { orderBys: {}, selects: [] },
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalCredit: '1000',
        totalDebit: '500',
        totalNetOff: '200',
        totalRemaining: '800',
      }),
    };

    qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      clone: jest.fn().mockReturnValue(totalsQbMock),
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
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      manager: managerMock,
    };

    transactionAccountingServiceMock = {
      getTransactionPosting: jest.fn().mockResolvedValue({}),
    };

    service = new TransactionQueryService(
      transactionRepoMock as any,
      transactionAccountingServiceMock as any,
    );
  });

  it('defaults to sorting by txn.transDate DESC, txn.createdAt DESC when no sort is passed', async () => {
    await service.getTransactions({ page: 1, pageSize: 20 });

    expect(qbMock.orderBy).toHaveBeenCalledWith('txn.transDate', 'DESC');
    expect(qbMock.addOrderBy).toHaveBeenCalledWith('txn.createdAt', 'DESC');
  });

  it('sorts by thu (creditAmount) DESC when requested', async () => {
    await service.getTransactions({
      page: 1,
      pageSize: 20,
      sortBy: 'thu',
      sortOrder: 'DESC',
    });

    expect(qbMock.orderBy).toHaveBeenCalledWith('txn.creditAmount', 'DESC');
    expect(qbMock.addOrderBy).toHaveBeenCalledWith('txn.createdAt', 'DESC');
  });

  it('sorts by account ASC for BANK source type', async () => {
    await service.getTransactions({
      page: 1,
      pageSize: 20,
      sourceType: 'BANK',
      sorts: ['account'],
    });

    expect(qbMock.orderBy).toHaveBeenCalledWith('bankAccount.bankName', 'ASC');
    expect(qbMock.addOrderBy).toHaveBeenCalledWith('txn.createdAt', 'DESC');
  });

  it('sorts by referenceNumber DESC using sorts array parameter', async () => {
    await service.getTransactions({
      page: 1,
      pageSize: 20,
      sorts: ['-referenceNumber'],
    });

    expect(qbMock.orderBy).toHaveBeenCalledWith('txn.referenceNumber', 'DESC');
    expect(qbMock.addOrderBy).toHaveBeenCalledWith('txn.createdAt', 'DESC');
  });

  it('sorts by correspondentName ASC when requested', async () => {
    await service.getTransactions({
      page: 1,
      pageSize: 20,
      sorts: ['correspondentName'],
    });

    expect(qbMock.orderBy).toHaveBeenCalledWith(
      "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))",
      'ASC',
    );
    expect(qbMock.addOrderBy).toHaveBeenCalledWith('txn.createdAt', 'DESC');
  });
});
