import { NotFoundException } from '@nestjs/common';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';

describe('InvoiceLifecycleService - linkVouchersToInvoice', () => {
  let service: InvoiceLifecycleService;
  let repository: any;
  let bankTransactionsCoreService: any;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      merge: jest.fn((target: any, source: any) =>
        Object.assign(target, source),
      ),
      save: jest.fn().mockImplementation(async (entity) => entity),
      manager: {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((_entity: any, data: any) => ({ ...data })),
        save: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        query: jest.fn(),
      },
    };

    bankTransactionsCoreService = {
      refreshJournalEntriesForBankTransaction: jest
        .fn()
        .mockResolvedValue(undefined),
    };

    service = new InvoiceLifecycleService(
      repository,
      { find: jest.fn().mockResolvedValue([]) } as any,
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
    expect(repository.manager.save).toHaveBeenCalled();
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
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
    expect(repository.manager.save).toHaveBeenCalled();
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
    expect(repository.manager.save).toHaveBeenCalled();
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
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
    expect(repository.manager.save).toHaveBeenCalled();
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
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
    expect(repository.manager.save).toHaveBeenCalled();
  });

  it('throws NotFoundException when invoice does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.linkVouchersToInvoice('inv-missing', [
        { bankTransactionId: 'txn-1', netOffAmount: 10 },
      ]),
    ).rejects.toThrow(NotFoundException);
  });

  it('unlinks voucher without refreshing statement journal entries', async () => {
    const result = await service.removeVoucherFromInvoice('inv-1', 'txn-1');

    expect(repository.manager.delete).toHaveBeenCalledWith(
      ErpInvoiceVoucherNetOff,
      {
        invoiceId: 'inv-1',
        bankTransactionId: 'txn-1',
      },
    );
    expect(result).toEqual({ message: 'Đã xóa liên kết phiếu thành công' });
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
  });

  it('updates invoice without refreshing linked statement journals', async () => {
    const invoice = {
      id: 'inv-1',
      isDeleted: false,
      branchId: 'branch-a',
      postingStatus: 'UNPOSTED',
      items: [],
    };

    repository.findOne
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce({ ...invoice, voucherNetOffs: [] });

    await service.update('inv-1', { notes: 'updated' } as any);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inv-1', notes: 'updated' }),
    );
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
  });

  it('unposts invoice and removes net-offs without refreshing statement journals', async () => {
    const invoice = {
      id: 'inv-1',
      postingStatus: 'POSTED',
      isDeleted: false,
    };

    repository.findOne.mockResolvedValue(invoice);
    repository.manager.find.mockResolvedValue([
      { invoiceId: 'inv-1', bankTransactionId: 'txn-1' },
      { invoiceId: 'inv-1', bankTransactionId: 'txn-2' },
    ]);

    await service.unpostInvoice('inv-1');

    expect(repository.manager.delete).toHaveBeenCalledWith(
      ErpInvoiceVoucherNetOff,
      { invoiceId: 'inv-1' },
    );
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
  });

  describe('autoPostStandard', () => {
    it('auto-posts IN invoice with 642 debit account for tax code in 642 list', async () => {
      const invoice = {
        id: 'inv-in-642',
        isDeleted: false,
        branchId: 'branch-1',
        postingStatus: 'UNPOSTED',
        direction: 'IN',
        sellerTaxCode: '0317121966',
        preVatAmount: 1000000,
        vatAmount: 100000,
        totalAmount: 1100000,
        invoiceNo: '0000123',
        invoiceDate: '2026-08-18',
      };

      repository.findOne.mockResolvedValue(invoice);
      repository.manager.query.mockResolvedValueOnce([
        { id: 'acc-642', account_code: '642' },
        { id: 'acc-632', account_code: '632' },
        { id: 'acc-133', account_code: '133' },
        { id: 'acc-331', account_code: '331' },
      ]);

      const spyPost = jest
        .spyOn(service, 'postInvoice')
        .mockResolvedValue(invoice as any);

      await service.autoPostStandard('inv-in-642');

      expect(spyPost).toHaveBeenCalledWith(
        'inv-in-642',
        expect.objectContaining({
          postingDate: '2026-08-18',
          lines: [
            expect.objectContaining({
              accountId: 'acc-642',
              debit: 1000000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-133',
              debit: 100000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-331',
              debit: 0,
              credit: 1100000,
            }),
          ],
        }),
      );
    });

    it('auto-posts IN invoice with 632 debit account for default/VinFast tax codes', async () => {
      const invoice = {
        id: 'inv-in-632',
        isDeleted: false,
        branchId: 'branch-1',
        postingStatus: 'UNPOSTED',
        direction: 'IN',
        sellerTaxCode: '0108926276', // VinFast
        preVatAmount: 5000000,
        vatAmount: 500000,
        totalAmount: 5500000,
        invoiceNo: '0000999',
        invoiceDate: '2026-08-18',
      };

      repository.findOne.mockResolvedValue(invoice);
      repository.manager.query.mockResolvedValueOnce([
        { id: 'acc-642', account_code: '642' },
        { id: 'acc-632', account_code: '632' },
        { id: 'acc-133', account_code: '133' },
        { id: 'acc-331', account_code: '331' },
      ]);

      const spyPost = jest
        .spyOn(service, 'postInvoice')
        .mockResolvedValue(invoice as any);

      await service.autoPostStandard('inv-in-632');

      expect(spyPost).toHaveBeenCalledWith(
        'inv-in-632',
        expect.objectContaining({
          postingDate: '2026-08-18',
          lines: [
            expect.objectContaining({
              accountId: 'acc-632',
              debit: 5000000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-133',
              debit: 500000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-331',
              debit: 0,
              credit: 5500000,
            }),
          ],
        }),
      );
    });

    it('auto-posts OUT invoice with 131, 511, 3331 accounts', async () => {
      const invoice = {
        id: 'inv-out-1',
        isDeleted: false,
        branchId: 'branch-1',
        postingStatus: 'UNPOSTED',
        direction: 'OUT',
        preVatAmount: 2000000,
        vatAmount: 200000,
        totalAmount: 2200000,
        invoiceNo: '0000777',
        invoiceDate: '2026-08-18',
      };

      repository.findOne.mockResolvedValue(invoice);
      repository.manager.query.mockResolvedValueOnce([
        { id: 'acc-131', account_code: '131' },
        { id: 'acc-511', account_code: '511' },
        { id: 'acc-3331', account_code: '3331' },
      ]);

      const spyPost = jest
        .spyOn(service, 'postInvoice')
        .mockResolvedValue(invoice as any);

      await service.autoPostStandard('inv-out-1');

      expect(spyPost).toHaveBeenCalledWith(
        'inv-out-1',
        expect.objectContaining({
          postingDate: '2026-08-18',
          lines: [
            expect.objectContaining({
              accountId: 'acc-131',
              debit: 2200000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-511',
              debit: 0,
              credit: 2000000,
            }),
            expect.objectContaining({
              accountId: 'acc-3331',
              debit: 0,
              credit: 200000,
            }),
          ],
        }),
      );
    });
  });
});
