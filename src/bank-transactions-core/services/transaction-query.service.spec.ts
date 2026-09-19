import { TransactionQueryService } from './transaction-query.service';
import { NotFoundException } from '@nestjs/common';

describe('TransactionQueryService', () => {
  let service: TransactionQueryService;
  let transactionRepo: any;
  let transactionAccountingService: any;
  let qb: any;

  beforeEach(() => {
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawOne: jest.fn().mockResolvedValue({ cnt: '0' }),
      getRawMany: jest.fn().mockResolvedValue([]),
      expressionMap: { groupBys: [] },
    };

    const countQb: any = {
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ cnt: '0', totalCredit: '0', totalDebit: '0' }),
      getRawMany: jest.fn().mockResolvedValue([]),
      expressionMap: {
        groupBys: [],
        orderBys: {},
        selects: [],
        joinAttributes: [],
      },
    };

    qb.clone.mockReturnValue(countQb);

    const netoffMock: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    transactionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(netoffMock),
      },
    };

    transactionAccountingService = {
      getTransactionPosting: jest.fn(),
    };

    service = new TransactionQueryService(
      transactionRepo,
      transactionAccountingService,
    );
  });

  it('combines transaction detail with posting data in getTransaction', async () => {
    const txn: any = { id: 'txn-1', isDeleted: false };
    transactionRepo.findOne.mockResolvedValue(txn);

    const netoffQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValue([{ bankTransactionId: 'txn-1', sum: '30' }]),
    };
    transactionRepo.manager.createQueryBuilder.mockReturnValue(netoffQb);

    transactionAccountingService.getTransactionPosting.mockResolvedValue({
      postingStatus: 'POSTED',
      totalDebit: 30,
      totalCredit: 30,
    });

    const result = await service.getTransaction('txn-1');

    expect(transactionRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'txn-1', isDeleted: false },
      relations: [
        'branch',
        'bankAccount',
        'cashBook',
        'invoiceNetOffs',
        'invoiceNetOffs.invoice',
      ],
    });
    expect(
      transactionAccountingService.getTransactionPosting,
    ).toHaveBeenCalledWith('txn-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'txn-1',
        netOffAmount: '30',
        postingStatus: 'POSTED',
      }),
    );
  });

  it('throws NotFoundException when getTransaction target is missing', async () => {
    transactionRepo.findOne.mockResolvedValue(null);

    await expect(service.getTransaction('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns empty pagination for getTransactions when no data', async () => {
    const result = await service.getTransactions({} as any);

    expect(transactionRepo.createQueryBuilder).toHaveBeenCalledWith('txn');
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      totals: {
        grandTotalCredit: 0,
        grandTotalDebit: 0,
        cumulativeCredit: 0,
        cumulativeDebit: 0,
      },
    });
  });

  it('applies GMT+7 timezone to startDate and endDate in getTransactions', async () => {
    await service.getTransactions({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    } as any);

    expect(qb.andWhere).toHaveBeenCalledWith(
      "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= :startDate::date",
      {
        startDate: '2026-07-01',
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= :endDate::date",
      {
        endDate: '2026-07-31',
      },
    );
  });

  it('returns empty options for unsupported column', async () => {
    const result = await service.getColumnOptions('unsupported', '', 1, 20);

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('calculates cumulative totals accurately for multi-page requests', async () => {
    qb.getManyAndCount.mockResolvedValue([
      [
        { id: 'txn-51', creditAmount: '5000000', debitAmount: '0' },
        { id: 'txn-52', creditAmount: '0', debitAmount: '2000000' },
      ],
      150,
    ]);

    const countQbMock: any = {
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        cnt: '150',
        totalCredit: '31000000000',
        totalDebit: '20000000000',
      }),
      getRawMany: jest.fn().mockResolvedValue([
        { credit: '663650173', debit: '100000000' },
        { credit: '939237898', debit: '400000000' },
      ]),
      expressionMap: {
        groupBys: [],
        orderBys: {},
        selects: [],
        joinAttributes: [],
      },
    };

    qb.clone.mockReturnValue(countQbMock);

    const result = await service.getTransactions({
      page: 2,
      pageSize: 50,
    } as any);

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.totals).toEqual({
      grandTotalCredit: 31000000000,
      grandTotalDebit: 20000000000,
      cumulativeCredit: 1602888071,
      cumulativeDebit: 500000000,
    });
  });
});
