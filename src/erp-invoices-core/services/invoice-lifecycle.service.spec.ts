import { NotFoundException } from '@nestjs/common';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';

describe('InvoiceLifecycleService - linkVouchersToInvoice', () => {
  let service: InvoiceLifecycleService;
  let repository: any;
  let bankTransactionsCoreService: any;
  let transactionAccountingService: any;

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

    bankTransactionsCoreService = {};

    transactionAccountingService = {
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
      transactionAccountingService,
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
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
    expect(
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-2');
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
    expect(
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
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
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
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
    expect(repository.manager.save).toHaveBeenCalled();
    expect(
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
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

  it('unlinks voucher and refreshes statement journal entries', async () => {
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
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith('txn-1');
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
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
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
      transactionAccountingService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
  });

  describe('autoPostStandard', () => {
    const originalEnv = process.env.ENABLE_LIVE_AUTO_POSTING;

    afterEach(() => {
      process.env.ENABLE_LIVE_AUTO_POSTING = originalEnv;
    });

    it('skips auto-posting when ENABLE_LIVE_AUTO_POSTING is not true', async () => {
      delete process.env.ENABLE_LIVE_AUTO_POSTING;
      const invoice = {
        id: 'inv-in-disabled',
        isDeleted: false,
        branchId: 'branch-1',
        postingStatus: 'UNPOSTED',
        direction: 'IN',
        totalAmount: 1100000,
        invoiceNo: '0000123',
      };
      repository.findOne.mockResolvedValue(invoice);
      const spyPost = jest.spyOn(service, 'postInvoice');

      const result = await service.autoPostStandard('inv-in-disabled');
      expect(result).toBe(invoice);
      expect(spyPost).not.toHaveBeenCalled();
    });

    it('auto-posts IN invoice with T0003 and 331 accounts when enabled', async () => {
      process.env.ENABLE_LIVE_AUTO_POSTING = 'true';
      const invoice = {
        id: 'inv-in-transit',
        isDeleted: false,
        branchId: 'branch-1',
        postingStatus: 'UNPOSTED',
        direction: 'IN',
        totalAmount: 1100000,
        invoiceNo: '0000123',
        invoiceDate: '2026-08-18',
      };

      repository.findOne.mockResolvedValue(invoice);
      repository.manager.query.mockResolvedValueOnce([
        { id: 'acc-t0003', account_code: 'T0003' },
        { id: 'acc-331', account_code: '331' },
      ]);

      const spyPost = jest
        .spyOn(service, 'postInvoice')
        .mockResolvedValue(invoice as any);

      await service.autoPostStandard('inv-in-transit');

      expect(spyPost).toHaveBeenCalledWith(
        'inv-in-transit',
        expect.objectContaining({
          postingDate: '2026-08-18',
          lines: [
            expect.objectContaining({
              accountId: 'acc-t0003',
              debit: 1100000,
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

    it('auto-posts OUT invoice with 131 and T0002 accounts when enabled', async () => {
      process.env.ENABLE_LIVE_AUTO_POSTING = 'true';
      const invoice = {
        id: 'inv-out-transit',
        isDeleted: false,
        branchId: 'branch-1',
        postingStatus: 'UNPOSTED',
        direction: 'OUT',
        totalAmount: 2200000,
        invoiceNo: '0000777',
        invoiceDate: '2026-08-18',
      };

      repository.findOne.mockResolvedValue(invoice);
      repository.manager.query.mockResolvedValueOnce([
        { id: 'acc-131', account_code: '131' },
        { id: 'acc-t0002', account_code: 'T0002' },
      ]);

      const spyPost = jest
        .spyOn(service, 'postInvoice')
        .mockResolvedValue(invoice as any);

      await service.autoPostStandard('inv-out-transit');

      expect(spyPost).toHaveBeenCalledWith(
        'inv-out-transit',
        expect.objectContaining({
          postingDate: '2026-08-18',
          lines: [
            expect.objectContaining({
              accountId: 'acc-131',
              debit: 2200000,
              credit: 0,
            }),
            expect.objectContaining({
              accountId: 'acc-t0002',
              debit: 0,
              credit: 2200000,
            }),
          ],
        }),
      );
    });
  });
});
