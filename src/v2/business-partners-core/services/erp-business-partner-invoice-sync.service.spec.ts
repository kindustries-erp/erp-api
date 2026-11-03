import {
  ErpBusinessPartnerInvoiceSyncService,
  groupCandidates,
} from './erp-business-partner-invoice-sync.service';

describe('groupCandidates', () => {
  it('keeps one candidate per tax code and picks the most frequent name', () => {
    const result = groupCandidates([
      {
        direction: 'OUT',
        taxCode: '0100',
        name: 'ABC',
        address: 'Hà Nội',
        invoiceCount: 2,
      },
      {
        direction: 'OUT',
        taxCode: '0100',
        name: 'ABC Co',
        address: null,
        invoiceCount: 5,
      },
    ]);
    expect(result).toEqual([
      {
        taxCode: '0100',
        name: 'ABC Co',
        address: 'Hà Nội',
        partnerType: 'CUSTOMER',
      },
    ]);
  });

  it('types the partner by the side with more invoices, and CUSTOMER on a tie', () => {
    const result = groupCandidates([
      {
        direction: 'OUT',
        taxCode: '0200',
        name: 'X',
        address: null,
        invoiceCount: 1,
      },
      {
        direction: 'IN',
        taxCode: '0200',
        name: 'X',
        address: null,
        invoiceCount: 3,
      },
      {
        direction: 'OUT',
        taxCode: '0300',
        name: 'Y',
        address: null,
        invoiceCount: 2,
      },
      {
        direction: 'IN',
        taxCode: '0300',
        name: 'Y',
        address: null,
        invoiceCount: 2,
      },
    ]);
    const byTax = Object.fromEntries(
      result.map((c) => [c.taxCode, c.partnerType]),
    );
    expect(byTax).toEqual({ '0200': 'VENDOR', '0300': 'CUSTOMER' });
  });

  it('ignores rows without a usable tax code', () => {
    expect(
      groupCandidates([
        {
          direction: 'OUT',
          taxCode: '   ',
          name: 'Khách lẻ',
          address: null,
          invoiceCount: 1,
        },
      ]),
    ).toEqual([]);
  });
});

describe('ErpBusinessPartnerInvoiceSyncService', () => {
  const candidateRow = {
    direction: 'OUT',
    taxCode: '0100',
    name: 'ABC',
    address: null,
    invoiceCount: 1,
  };

  const build = (existingTax: string[], taken: boolean[] = []) => {
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (
          sql.includes('FROM erp_invoices') ||
          sql.includes('AS "invoiceCount"')
        ) {
          return [candidateRow];
        }
        if (sql.includes('AS "taxCode" FROM erp_business_partners')) {
          return existingTax.map((taxCode) => ({ taxCode }));
        }
        return taken.length > 0 && taken.shift() ? [{ '?column?': 1 }] : [];
      }),
    };
    const query = { findCodesForNextCode: jest.fn().mockResolvedValue([]) };
    const command = { create: jest.fn(async (dto) => ({ ...dto, id: 'new' })) };
    const service = new ErpBusinessPartnerInvoiceSyncService(
      dataSource as never,
      query as never,
      command as never,
    );
    return { service, command, query };
  };

  it('dry-run lists missing tax codes and creates nothing', async () => {
    const { service, command } = build([]);
    const items = await service.findMissingCandidates();
    expect(items).toEqual([
      { taxCode: '0100', name: 'ABC', address: null, partnerType: 'CUSTOMER' },
    ]);
    expect(command.create).not.toHaveBeenCalled();
  });

  it('skips tax codes that already belong to a partner', async () => {
    const { service } = build(['0100']);
    await expect(service.findMissingCandidates()).resolves.toEqual([]);
  });

  it('run creates partners with codes from the type prefix (KH- for customers)', async () => {
    const { service, command } = build([]);
    const result = await service.run();
    expect(result.created).toBe(1);
    expect(command.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'KH-001',
        taxCode: '0100',
        partnerType: 'CUSTOMER',
        status: 'ACTIVE',
      }),
    );
  });

  it('run re-checks each tax code right before creating, so a second run creates nothing', async () => {
    const { service, command } = build([], [true]);
    const result = await service.run();
    expect(result.created).toBe(0);
    expect(command.create).not.toHaveBeenCalled();
  });
});
