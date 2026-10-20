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
      getJournalEntriesBySource: jest.fn().mockResolvedValue([]),
    };

    service = new TransactionAccountingService(
      transactionRepo,
      dataSource,
      accountingCoreService,
    );
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
