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
      .mockResolvedValueOnce([{ date: new Date('2026-07-23') }]);

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
