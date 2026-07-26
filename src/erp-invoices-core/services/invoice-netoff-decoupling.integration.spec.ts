import { describe, expect, it, jest } from '@jest/globals';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { ErpInvoiceVoucherNetOff } from '../entities/erp_invoice_voucher_netoff.entity';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';

function setupFixture() {
  const invoice: any = {
    id: 'inv-1',
    isDeleted: false,
    branchId: null,
    postingStatus: 'UNPOSTED',
    status: 'DRAFT',
    direction: 'IN',
    invoiceNo: 'INV-001',
    serialNo: null,
    invoiceDate: '2026-07-26',
    description: 'Seed invoice',
    notes: null,
    items: [],
    voucherNetOffs: [],
  };

  const statementTxns = [
    { id: 'txn-1', branchId: 'branch-a', isDeleted: false },
    { id: 'txn-2', branchId: 'branch-a', isDeleted: false },
  ];

  const netOffs: any[] = [];

  const repository: any = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.id === invoice.id && where?.isDeleted === false) {
        return invoice;
      }
      if (
        where?.id === invoice.id &&
        where?.id &&
        where?.isDeleted === undefined
      ) {
        return invoice;
      }
      return null;
    }),
    merge: jest.fn((target: any, source: any) => Object.assign(target, source)),
    save: jest.fn(async (entity: any) => entity),
    manager: {
      create: jest.fn((_entity: any, data: any) => ({ ...data })),
      save: jest.fn(async (_entity: any, entities: any[]) => {
        if (Array.isArray(entities)) {
          netOffs.push(...entities.map((e) => ({ ...e })));
        }
        return entities;
      }),
      find: jest.fn(async (entity: any, opts: any) => {
        if (entity === ErpBankTransaction) {
          const ids = opts?.where?.id?._value ?? opts?.where?.id;
          if (Array.isArray(ids)) {
            return statementTxns.filter((t) => ids.includes(t.id));
          }
          return statementTxns;
        }

        if (entity === ErpInvoiceVoucherNetOff) {
          const invoiceId = opts?.where?.invoiceId;
          return netOffs.filter((n) => n.invoiceId === invoiceId);
        }

        return [];
      }),
      delete: jest.fn(async (entity: any, criteria: any) => {
        if (entity === ErpInvoiceVoucherNetOff) {
          if (criteria?.invoiceId && criteria?.bankTransactionId) {
            for (let i = netOffs.length - 1; i >= 0; i -= 1) {
              if (
                netOffs[i].invoiceId === criteria.invoiceId &&
                netOffs[i].bankTransactionId === criteria.bankTransactionId
              ) {
                netOffs.splice(i, 1);
              }
            }
          } else if (criteria?.invoiceId) {
            for (let i = netOffs.length - 1; i >= 0; i -= 1) {
              if (netOffs[i].invoiceId === criteria.invoiceId) {
                netOffs.splice(i, 1);
              }
            }
          }
        }
        return { affected: 1 };
      }),
    },
  };

  const bankTransactionsCoreService = {
    refreshJournalEntriesForBankTransaction: jest.fn(async () => undefined),
  };

  const accountingCoreService = {
    createJournalEntry: jest.fn(),
    deleteJournalEntryBySource: jest.fn(
      async (_sourceId: string, _sourceType: string) => undefined,
    ),
    updateJournalEntryBranch: jest.fn(
      async (_sourceId: string, _branchId: string | null) => undefined,
    ),
  };

  const service = new InvoiceLifecycleService(
    repository,
    { deleteObject: jest.fn() } as any,
    bankTransactionsCoreService as any,
    accountingCoreService as any,
  );

  return {
    service,
    invoice,
    netOffs,
    repository,
    bankTransactionsCoreService,
    accountingCoreService,
  };
}

describe('Invoice net-off decoupling integration', () => {
  it('does not refresh statement journals across link, unlink, and unpost flow', async () => {
    const {
      service,
      invoice,
      netOffs,
      bankTransactionsCoreService,
      accountingCoreService,
    } = setupFixture();

    await service.linkVouchersToInvoice('inv-1', [
      { bankTransactionId: 'txn-1', netOffAmount: 100 },
      { bankTransactionId: 'txn-2', netOffAmount: 50 },
    ]);

    expect(invoice.branchId).toBe('branch-a');
    expect(netOffs).toHaveLength(2);
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();

    await service.removeVoucherFromInvoice('inv-1', 'txn-2');

    expect(netOffs).toHaveLength(1);
    expect(netOffs[0].bankTransactionId).toBe('txn-1');
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();

    invoice.postingStatus = 'POSTED';
    await service.unpostInvoice('inv-1');

    expect(
      accountingCoreService.deleteJournalEntryBySource,
    ).toHaveBeenCalledWith('inv-1', 'INVOICE');
    expect(netOffs).toHaveLength(0);
    expect(invoice.postingStatus).toBe('UNPOSTED');
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
  });

  it('updates invoice data without mutating statement journals even when net-offs exist', async () => {
    const { service, netOffs, bankTransactionsCoreService, invoice } =
      setupFixture();

    netOffs.push({
      invoiceId: 'inv-1',
      bankTransactionId: 'txn-1',
      netOffAmount: 200,
    });

    const result = await service.update('inv-1', {
      notes: 'updated note',
    } as any);

    expect(invoice.notes).toBe('updated note');
    expect(result.data.notes).toBe('updated note');
    expect(
      bankTransactionsCoreService.refreshJournalEntriesForBankTransaction,
    ).not.toHaveBeenCalled();
  });
});
