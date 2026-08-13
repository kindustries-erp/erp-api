import { BankTransactionsCoreService } from './bank-transactions-core.service';

describe('BankTransactionsCoreService - accounting delegation', () => {
  let service: BankTransactionsCoreService;
  let transactionAccountingService: any;

  beforeEach(() => {
    transactionAccountingService = {
      refreshJournalEntriesForBankTransaction: jest
        .fn()
        .mockResolvedValue(undefined),
    };

    service = new BankTransactionsCoreService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      transactionAccountingService,
    );
  });

  it('delegates refreshJournalEntriesForBankTransaction to accounting service', async () => {
    await service.refreshJournalEntriesForBankTransaction('txn-1');

    expect(
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
  });
});
