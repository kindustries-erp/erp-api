import { BadRequestException } from '@nestjs/common';
import { TransactionAccountingService } from './transaction-accounting.service';

describe('TransactionAccountingService', () => {
  let service: TransactionAccountingService;
  let transactionRepo: any;
  let dataSource: any;
  let accountingCoreService: any;

  beforeEach(() => {
    transactionRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (entity) => ({ id: 'txn-1', ...entity })),
    };

    dataSource = {
      query: jest.fn(),
    };

    accountingCoreService = {
      deleteJournalEntryBySource: jest.fn().mockResolvedValue(undefined),
      generateEntryNo: jest.fn().mockResolvedValue('BANK-0001'),
      createJournalEntry: jest.fn().mockResolvedValue({ id: 'je-1' }),
      createJournalEntriesForBranches: jest
        .fn()
        .mockResolvedValue({ id: 'je-1' }),
      getJournalEntriesBySource: jest.fn().mockResolvedValue([]),
    };

    service = new TransactionAccountingService(
      transactionRepo,
      dataSource,
      accountingCoreService,
    );
  });

  it('postTransaction (nhập tay) tạo bút toán theo danh sách chi nhánh của giao dịch', async () => {
    transactionRepo.findOne.mockResolvedValue({
      id: 'txn-1',
      isDeleted: false,
      sourceType: 'BANK',
      branchId: 'branch-1',
      branchIds: ['branch-1', 'branch-2'],
      creditAmount: 200,
      debitAmount: 0,
      transDate: new Date('2026-07-23'),
    });
    dataSource.query.mockResolvedValue([{ id: '1121' }, { id: '331' }]);

    await service
      .postTransaction('txn-1', {
        lines: [
          { accountId: '1121', debit: 200, credit: 0, description: 'Thu' },
          { accountId: '331', debit: 0, credit: 200, description: 'Thu' },
        ],
      } as any)
      .catch(() => undefined);

    expect(
      accountingCoreService.createJournalEntriesForBranches,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        branchIds: ['branch-1', 'branch-2'],
        sourceId: 'txn-1',
      }),
    );
    expect(accountingCoreService.createJournalEntry).not.toHaveBeenCalled();
  });

  it('createManualTransaction throws when both bankAccountId and cashBookId are missing', async () => {
    await expect(
      service.createManualTransaction({
        sourceType: 'BANK',
        branchId: 'branch-1',
        transDate: new Date('2026-08-09'),
        debitAmount: 0,
        creditAmount: 100,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createManualTransaction persists transaction when source account is provided', async () => {
    const dto: any = {
      sourceType: 'BANK',
      branchId: 'branch-1',
      bankAccountId: 'bank-1',
      transDate: new Date('2026-08-09'),
      debitAmount: 0,
      creditAmount: 100,
      description: 'Thu tien',
    };

    const result = await service.createManualTransaction(dto);

    expect(transactionRepo.create).toHaveBeenCalledWith(dto);
    expect(transactionRepo.save).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 'txn-1' }));
  });

  describe('cashflow classification / purpose pairing', () => {
    const baseCreateDto = {
      sourceType: 'BANK',
      branchId: 'branch-1',
      bankAccountId: 'bank-1',
      transDate: new Date('2026-08-09'),
      debitAmount: 0,
      creditAmount: 100,
    };

    it('createManualTransaction rejects purpose outside the chosen classification', async () => {
      await expect(
        service.createManualTransaction({
          ...baseCreateDto,
          cashflowClassification: 'FINANCING',
          cashflowPurpose: 'SALARY',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('createManualTransaction rejects purpose without classification', async () => {
      await expect(
        service.createManualTransaction({
          ...baseCreateDto,
          cashflowClassification: null,
          cashflowPurpose: 'LOAN',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('createManualTransaction accepts a valid pair', async () => {
      await expect(
        service.createManualTransaction({
          ...baseCreateDto,
          cashflowClassification: 'FINANCING',
          cashflowPurpose: 'LOAN',
        } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('refreshJournalEntriesForBankTransaction', () => {
    const originalEnv = process.env.ENABLE_LIVE_AUTO_POSTING;

    afterEach(() => {
      process.env.ENABLE_LIVE_AUTO_POSTING = originalEnv;
    });

    it('skips journal entry creation when ENABLE_LIVE_AUTO_POSTING is not true and no existing entries', async () => {
      delete process.env.ENABLE_LIVE_AUTO_POSTING;

      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        isDeleted: false,
        sourceType: 'BANK',
        branchId: 'statement-branch',
        bankAccount: { accountingAccountId: '1121-account' },
        creditAmount: 100,
        debitAmount: 0,
        transDate: new Date('2026-07-23'),
      });

      dataSource.query
        .mockResolvedValueOnce([{ id: '331-account' }]) // 331
        .mockResolvedValueOnce([{ id: '131-account' }]) // 131
        .mockResolvedValueOnce([{ id: 't0001-account' }]) // T0001
        .mockResolvedValueOnce([]) // net-off rows
        .mockResolvedValueOnce([]); // existing entries (empty)

      await service.refreshJournalEntriesForBankTransaction('txn-1');

      expect(accountingCoreService.createJournalEntry).not.toHaveBeenCalled();
    });

    it('uses T0001 as counterpart when transaction has no net-off and ENABLE_LIVE_AUTO_POSTING is true', async () => {
      process.env.ENABLE_LIVE_AUTO_POSTING = 'true';

      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        isDeleted: false,
        sourceType: 'BANK',
        branchId: 'branch-1',
        bankAccount: { accountingAccountId: '1121-account' },
        creditAmount: 500, // Tiền vào (Receipt)
        debitAmount: 0,
        accountingDescription: 'Tien vao tk',
        correspondentAccountingAccountId: null,
        transDate: new Date('2026-07-23'),
      });

      dataSource.query
        .mockResolvedValueOnce([{ id: '331-account' }]) // 331
        .mockResolvedValueOnce([{ id: '131-account' }]) // 131
        .mockResolvedValueOnce([{ id: 't0001-account' }]) // T0001
        .mockResolvedValueOnce([]) // netoff rows
        .mockResolvedValueOnce([]); // existing entries

      await service.refreshJournalEntriesForBankTransaction('txn-1');

      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-1',
          sourceType: 'BANK',
          sourceId: 'txn-1',
          lines: [
            expect.objectContaining({
              accountId: '1121-account',
              debit: 500,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 't0001-account',
              debit: 0,
              credit: 500,
            }),
          ],
        }),
      );
    });

    it('splits the journal entry evenly across multiple branchIds', async () => {
      process.env.ENABLE_LIVE_AUTO_POSTING = 'true';

      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        isDeleted: false,
        sourceType: 'BANK',
        branchId: 'branch-1',
        branchIds: ['branch-1', 'branch-2'],
        bankAccount: { accountingAccountId: '1121-account' },
        creditAmount: 100,
        debitAmount: 0,
        accountingDescription: 'Tien vao tk',
        correspondentAccountingAccountId: null,
        transDate: new Date('2026-07-23'),
      });

      dataSource.query
        .mockResolvedValueOnce([{ id: '331-account' }])
        .mockResolvedValueOnce([{ id: '131-account' }])
        .mockResolvedValueOnce([{ id: 't0001-account' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.refreshJournalEntriesForBankTransaction('txn-1');

      const calls = (accountingCoreService.createJournalEntry as jest.Mock).mock
        .calls;
      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c[0].branchId)).toEqual(['branch-1', 'branch-2']);
      expect(calls.map((c) => c[0].lines[0].debit)).toEqual([50, 50]);
    });

    it('creates a single entry with null branch when branchIds and branchId are empty', async () => {
      process.env.ENABLE_LIVE_AUTO_POSTING = 'true';

      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        isDeleted: false,
        sourceType: 'BANK',
        branchId: null,
        branchIds: [],
        bankAccount: { accountingAccountId: '1121-account' },
        creditAmount: 100,
        debitAmount: 0,
        accountingDescription: 'Tien vao tk',
        correspondentAccountingAccountId: null,
        transDate: new Date('2026-07-23'),
      });

      dataSource.query
        .mockResolvedValueOnce([{ id: '331-account' }])
        .mockResolvedValueOnce([{ id: '131-account' }])
        .mockResolvedValueOnce([{ id: 't0001-account' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.refreshJournalEntriesForBankTransaction('txn-1');

      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledTimes(1);
      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: null }),
      );
    });

    it('shifts counterpart to 331 when net-off with IN invoice', async () => {
      process.env.ENABLE_LIVE_AUTO_POSTING = 'true';

      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-payment',
        isDeleted: false,
        sourceType: 'BANK',
        branchId: 'branch-1',
        bankAccount: { accountingAccountId: '1121-account' },
        creditAmount: 0,
        debitAmount: 300, // Tiền ra (Payment)
        accountingDescription: 'Thanh toan tien hang',
        correspondentAccountingAccountId: null,
        transDate: new Date('2026-07-23'),
      });

      dataSource.query
        .mockResolvedValueOnce([{ id: '331-account' }]) // 331
        .mockResolvedValueOnce([{ id: '131-account' }]) // 131
        .mockResolvedValueOnce([{ id: 't0001-account' }]) // T0001
        .mockResolvedValueOnce([
          {
            id: 'netoff-1',
            net_off_amount: '300',
            direction: 'IN',
            seller_name: 'Nha Cung Cap A',
            invoice_no: 'INV-IN-01',
          },
        ]) // net-off row
        .mockResolvedValueOnce([]); // existing entries

      await service.refreshJournalEntriesForBankTransaction('txn-payment');

      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              accountId: '331-account',
              debit: 300,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: '1121-account',
              debit: 0,
              credit: 300,
            }),
          ],
        }),
      );
    });

    it('uses statement branch for bank journal entry even when linked invoice has different branch', async () => {
      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        isDeleted: false,
        sourceType: 'BANK',
        branchId: 'statement-branch',
        bankAccount: { accountingAccountId: '1121-account' },
        cashBook: null,
        creditAmount: 100,
        debitAmount: 0,
        accountingDescription: 'Thu tien',
        description: 'Thu tien',
        correspondentAccountingAccountId: 'counterpart-account',
        correspondentName: 'Partner A',
        transDate: new Date('2026-07-23'),
        referenceNumber: 'REF-001',
      });

      dataSource.query
        .mockResolvedValueOnce([{ id: '331-account' }])
        .mockResolvedValueOnce([{ id: '131-account' }])
        .mockResolvedValueOnce([{ id: 't0001-account' }])
        .mockResolvedValueOnce([
          {
            id: 'netoff-1',
            net_off_amount: '100',
            direction: 'IN',
            seller_name: 'Vendor A',
            buyer_name: null,
            invoice_no: 'INV-001',
            serial_no: null,
            branch_id: 'invoice-branch',
            invoice_desc: 'Invoice desc',
          },
        ])
        .mockResolvedValueOnce([{ date: new Date('2026-07-23') }]); // existing entry present

      await service.refreshJournalEntriesForBankTransaction('txn-1');

      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledTimes(1);
      expect(accountingCoreService.createJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'statement-branch',
          sourceType: 'BANK',
          sourceId: 'txn-1',
        }),
      );
    });
  });
});
