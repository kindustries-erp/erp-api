import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceDebtsNetOffService } from './invoice-debts-net-off.service';
import { ErpInvoiceVoucherNetOff } from '../../entities/erp_invoice_voucher_netoff.entity';
import { InvoicePartnerType } from '../../dto/get-invoice-debts.dto';
import { DebtNetOffAllocateDto } from '../../dto/debt-net-off.dto';

const PARTNER_TAX = '0100000001';
const TXN_ID = '11111111-1111-4111-8111-111111111111';
const INV_A = '22222222-2222-4222-8222-222222222222';
const INV_B = '33333333-3333-4333-8333-333333333333';

interface Fixture {
  txn?: Record<string, unknown> | null;
  invoices?: Record<string, unknown>[];
  existingNetOff?: Record<string, unknown> | null;
  txnRefreshFails?: boolean;
}

function setup(fixture: Fixture = {}) {
  const txn =
    fixture.txn === undefined
      ? {
          id: TXN_ID,
          debitAmount: '1000000',
          creditAmount: '0',
          netOffAmount: '0',
          branchId: null,
          branchIds: [],
        }
      : fixture.txn;
  const invoices = fixture.invoices ?? [
    invoiceRow(INV_A, 600000),
    invoiceRow(INV_B, 400000),
  ];
  const saved: unknown[] = [];

  const manager: any = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FOR UPDATE OF t')) return txn ? [txn] : [];
      if (sql.includes('FOR UPDATE OF inv')) return invoices;
      return [];
    }),
    findOne: jest.fn(async () => fixture.existingNetOff ?? null),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(async (_entity: unknown, entity: unknown) => {
      saved.push(entity);
      return entity;
    }),
  };
  const dataSource: any = {
    transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
      cb(manager),
    ),
  };
  const branchService: any = { assign: jest.fn(async () => ({})) };
  const transactionAccounting: any = {
    refreshJournalEntriesForBankTransaction: fixture.txnRefreshFails
      ? jest.fn(async () => {
          throw new Error('journal down');
        })
      : jest.fn(async () => undefined),
  };

  const service = new InvoiceDebtsNetOffService(
    dataSource,
    branchService,
    transactionAccounting,
  );
  return { service, manager, branchService, transactionAccounting, saved };
}

function invoiceRow(id: string, total: number, overrides: object = {}) {
  return {
    id,
    direction: 'IN',
    sellerTaxCode: PARTNER_TAX,
    buyerTaxCode: null,
    buyerCccd: null,
    totalAmount: String(total),
    taxInvoiceStatus: 1,
    netOffAmount: '0',
    adjustmentOffset: '0',
    ...overrides,
  };
}

function dto(
  allocations: { invoiceId: string; amount: number }[],
  partnerType = InvoicePartnerType.SUPPLIER,
): DebtNetOffAllocateDto {
  return {
    partnerType,
    bankTransactionId: TXN_ID,
    allocations,
  };
}

describe('InvoiceDebtsNetOffService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('phân bổ một giao dịch chi cho nhiều hóa đơn NCC và ghi đủ link', async () => {
    const { service, saved, transactionAccounting } = setup();

    const result = await service.allocate(
      PARTNER_TAX,
      dto([
        { invoiceId: INV_A, amount: 600000 },
        { invoiceId: INV_B, amount: 400000 },
      ]),
    );

    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      invoiceId: INV_A,
      bankTransactionId: TXN_ID,
      netOffAmount: 600000,
    });
    expect(result.allocations).toEqual([
      { invoiceId: INV_A, amount: 600000 },
      { invoiceId: INV_B, amount: 400000 },
    ]);
    expect(
      transactionAccounting.refreshJournalEntriesForBankTransaction,
    ).toHaveBeenCalledWith(TXN_ID);
  });

  it('cộng dồn khi cặp hóa đơn-giao dịch đã có link trước đó', async () => {
    const { service, saved } = setup({
      existingNetOff: {
        invoiceId: INV_A,
        bankTransactionId: TXN_ID,
        netOffAmount: '100000',
      },
    });

    await service.allocate(
      PARTNER_TAX,
      dto([{ invoiceId: INV_A, amount: 200000 }]),
    );

    expect(saved[0]).toMatchObject({ netOffAmount: 300000 });
    expect(saved).toHaveLength(1);
  });

  it('gán chi nhánh cho hóa đơn khi giao dịch có đúng một chi nhánh', async () => {
    const { service, branchService } = setup({
      txn: {
        id: TXN_ID,
        debitAmount: '1000000',
        creditAmount: '0',
        netOffAmount: '0',
        branchId: 'branch-1',
        branchIds: ['branch-1'],
      },
    });

    await service.allocate(
      PARTNER_TAX,
      dto([{ invoiceId: INV_A, amount: 500000 }]),
    );

    expect(branchService.assign).toHaveBeenCalledWith([INV_A], ['branch-1'], {
      onlyIfUnassigned: true,
    });
  });

  it('không làm fail giao dịch khi làm mới bút toán lỗi sau commit', async () => {
    const { service, saved } = setup({
      txnRefreshFails: true,
    });

    await expect(
      service.allocate(
        PARTNER_TAX,
        dto([{ invoiceId: INV_A, amount: 100000 }]),
      ),
    ).resolves.toBeDefined();
    expect(saved).toHaveLength(1);
  });

  it('từ chối MST rỗng hoặc KHONG_MST', async () => {
    const { service } = setup();

    await expect(
      service.allocate('KHONG_MST', dto([{ invoiceId: INV_A, amount: 1 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.allocate('  ', dto([{ invoiceId: INV_A, amount: 1 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối danh sách có hóa đơn trùng', async () => {
    const { service } = setup();

    await expect(
      service.allocate(
        PARTNER_TAX,
        dto([
          { invoiceId: INV_A, amount: 100 },
          { invoiceId: INV_A, amount: 100 },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối khi giao dịch không thuộc đối tác hoặc không tồn tại', async () => {
    const { service } = setup({ txn: null });

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 100 }])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('từ chối chiều giao dịch không khớp loại đối tác', async () => {
    // Giao dịch thu (credit) nhưng đối tác là NCC (cần chi)
    const { service } = setup({
      txn: {
        id: TXN_ID,
        debitAmount: '0',
        creditAmount: '1000000',
        netOffAmount: '0',
        branchId: null,
        branchIds: [],
      },
    });

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 100 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối khi tổng phân bổ vượt số chưa phân bổ của giao dịch', async () => {
    const { service, manager } = setup({
      txn: {
        id: TXN_ID,
        debitAmount: '1000000',
        creditAmount: '0',
        netOffAmount: '700000',
        branchId: null,
        branchIds: [],
      },
    });

    await expect(
      service.allocate(
        PARTNER_TAX,
        dto([{ invoiceId: INV_A, amount: 400000 }]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('từ chối hóa đơn không thuộc đối tác', async () => {
    const { service } = setup({
      invoices: [invoiceRow(INV_A, 600000, { sellerTaxCode: '9999999999' })],
    });

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 100 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối hóa đơn sai chiều (HĐ bán ra cho NCC)', async () => {
    const { service } = setup({
      invoices: [invoiceRow(INV_A, 600000, { direction: 'OUT' })],
    });

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 100 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối phân bổ vượt số dư còn lại của hóa đơn (đã trừ cấn trước đó)', async () => {
    const { service } = setup({
      invoices: [invoiceRow(INV_A, 600000, { netOffAmount: '550000' })],
    });

    await expect(
      service.allocate(
        PARTNER_TAX,
        dto([{ invoiceId: INV_A, amount: 100000 }]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối hóa đơn điều chỉnh giảm (tax status 3)', async () => {
    const { service } = setup({
      invoices: [invoiceRow(INV_A, 600000, { taxInvoiceStatus: 3 })],
    });

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 100 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối hóa đơn không còn tồn tại (đã bị thay thế hoặc xóa)', async () => {
    const { service } = setup({ invoices: [] });

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 100 }])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('từ chối số tiền phân bổ bằng 0 sau làm tròn cent', async () => {
    const { service } = setup();

    await expect(
      service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 0.001 }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dùng đúng kiểu ErpInvoiceVoucherNetOff khi tạo link mới', async () => {
    const { service, manager } = setup();

    await service.allocate(PARTNER_TAX, dto([{ invoiceId: INV_A, amount: 1 }]));

    expect(manager.create).toHaveBeenCalledWith(
      ErpInvoiceVoucherNetOff,
      expect.objectContaining({ invoiceId: INV_A, bankTransactionId: TXN_ID }),
    );
  });
});
