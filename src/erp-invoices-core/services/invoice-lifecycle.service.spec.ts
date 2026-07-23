import { NotFoundException } from '@nestjs/common';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';

describe('InvoiceLifecycleService - linkVouchersToInvoice', () => {
  let service: InvoiceLifecycleService;
  let repository: any;
  let bankTransactionsCoreService: any;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity) => entity),
      manager: {
        find: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((_entity: any, data: any) => ({ ...data })),
        save: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      },
    };

    bankTransactionsCoreService = {
      refreshJournalEntriesForBankTransaction: jest
        .fn()
        .mockResolvedValue(undefined),
    };

    service = new InvoiceLifecycleService(
      repository,
      { deleteObject: jest.fn() } as any,
      bankTransactionsCoreService,
      {
        createJournalEntry: jest.fn(),
        deleteJournalEntryBySource: jest.fn(),
        updateJournalEntryBranch: jest.fn(),
      } as any,
    );
  });

  it('auto-sets invoice branch when invoice has no branch and all linked statements share one branch', async () => {
    repository.findOne.mockResolvedValue({
      id: 'inv-1',
      isDeleted: false,
      branchId: null,
    });
    repository.manager.find.mockResolvedValue([
      { id: 'txn-1', branchId: 'branch-a' },
      { id: 'txn-2', branchId: 'branch-a' },
    ]);

    await service.linkVouchersToInvoice('inv-1', [
      { bankTransactionId: 'txn-1', netOffAmount: 100 },
      { bankTransactionId: 'txn-2', netOffAmount: 50 },
    ]);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inv-1', branchId: 'branch-a' }),
    );
    expect(repository.manager.save).toHaveBeenCalledTimes(1);
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledTimes(2);
  });

  it('skips auto-set when linked statements have mixed branches but still links vouchers', async () => {
    repository.findOne.mockResolvedValue({
      id: 'inv-1',
      isDeleted: false,
      branchId: null,
    });
    repository.manager.find.mockResolvedValue([
      { id: 'txn-1', branchId: 'branch-a' },
      { id: 'txn-2', branchId: 'branch-b' },
    ]);

    const result = await service.linkVouchersToInvoice('inv-1', [
      { bankTransactionId: 'txn-1', netOffAmount: 100 },
      { bankTransactionId: 'txn-2', netOffAmount: 50 },
    ]);

    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.manager.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: 'Đã liên kết phiếu thành công' });
  });

  it('does not override existing invoice branch', async () => {
    repository.findOne.mockResolvedValue({
      id: 'inv-1',
      isDeleted: false,
      branchId: 'branch-existing',
    });

    await service.linkVouchersToInvoice('inv-1', [
      { bankTransactionId: 'txn-1', netOffAmount: 10 },
    ]);

    expect(repository.manager.find).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.manager.save).toHaveBeenCalledTimes(1);
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
  });

  it('skips auto-set when one or more linked statements are missing', async () => {
    repository.findOne.mockResolvedValue({
      id: 'inv-1',
      isDeleted: false,
      branchId: null,
    });
    repository.manager.find.mockResolvedValue([
      { id: 'txn-1', branchId: 'branch-a' },
    ]);

    await service.linkVouchersToInvoice('inv-1', [
      { bankTransactionId: 'txn-1', netOffAmount: 10 },
      { bankTransactionId: 'txn-2', netOffAmount: 20 },
    ]);

    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.manager.save).toHaveBeenCalledTimes(1);
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledTimes(2);
  });

  it('skips auto-set when linked statements have empty branch', async () => {
    repository.findOne.mockResolvedValue({
      id: 'inv-1',
      isDeleted: false,
      branchId: null,
    });
    repository.manager.find.mockResolvedValue([
      { id: 'txn-1', branchId: 'branch-a' },
      { id: 'txn-2', branchId: null },
    ]);

    await service.linkVouchersToInvoice('inv-1', [
      { bankTransactionId: 'txn-1', netOffAmount: 10 },
      { bankTransactionId: 'txn-2', netOffAmount: 20 },
    ]);

    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.manager.save).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when invoice does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.linkVouchersToInvoice('inv-missing', [
        { bankTransactionId: 'txn-1', netOffAmount: 10 },
      ]),
    ).rejects.toThrow(NotFoundException);
  });
});
