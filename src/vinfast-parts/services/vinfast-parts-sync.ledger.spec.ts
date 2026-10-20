import { VinfastPartsSyncService } from './vinfast-parts-sync.service';

const VINFAST_SELLER = {
  sellerName: 'CÔNG TY CỔ PHẦN VINFAST VIỆT NAM',
  sellerTaxCode: '0202357718',
};

function itemRow(overrides: Record<string, any>) {
  return {
    id: 'ii-1',
    itemCode: 'VF-BEX20000923',
    description: 'BEX20000923 - CỤM MÁNG',
    unit: 'Chiếc',
    quantity: '2',
    unitPrice: '100',
    preVatAmount: '200',
    invoice: {
      id: 'inv-1',
      direction: 'IN',
      invoiceType: 1,
      taxInvoiceStatus: 1,
      invoiceDate: new Date('2026-06-01'),
      licensePlate: null,
      ...VINFAST_SELLER,
    },
    ...overrides,
  };
}

describe('VinfastPartsSyncService.syncLedger batch behaviour', () => {
  let service: VinfastPartsSyncService;
  let ledgerRepo: any;
  let catalogRepo: any;
  let items: any[];
  let progress: { next: jest.Mock };

  beforeEach(() => {
    items = [];
    const qb: any = {};
    const chain = () => qb;
    qb.innerJoin = chain;
    qb.select = chain;
    qb.addSelect = chain;
    qb.where = chain;
    qb.andWhere = chain;
    qb.getMany = jest.fn(async () => items);

    const invoiceItemRepo = { createQueryBuilder: jest.fn(() => qb) };

    catalogRepo = {
      find: jest.fn().mockResolvedValue([
        { sku: 'VF-BEX20000923', isService: false },
        { sku: 'VF-LFP00000216', isService: true },
      ]),
      findOne: jest.fn(() => {
        throw new Error('catalogRepo.findOne must not be called per row');
      }),
    };
    ledgerRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(() => {
        throw new Error('ledgerRepo.findOne must not be called per row');
      }),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
      remove: jest.fn(async (x) => x),
      delete: jest.fn(),
    };
    progress = { next: jest.fn() };

    service = new VinfastPartsSyncService(
      catalogRepo,
      ledgerRepo,
      invoiceItemRepo as any,
    );
  });

  it('adds a new purchase line that maps to a catalog part, without per-row lookups', async () => {
    items = [itemRow({})];

    await service.syncLedger({ progress$: progress });

    expect(catalogRepo.findOne).not.toHaveBeenCalled();
    expect(ledgerRepo.findOne).not.toHaveBeenCalled();
    expect(ledgerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        partSku: 'VF-BEX20000923',
        invoiceItemId: 'ii-1',
        direction: 'IN',
        qty: 2,
      }),
    );
  });

  it('does not save an existing ledger row whose values did not change', async () => {
    items = [itemRow({})];
    ledgerRepo.find.mockResolvedValue([
      {
        id: 'l-1',
        partSku: 'VF-BEX20000923',
        invoiceItemId: 'ii-1',
        invoiceId: 'inv-1',
        direction: 'IN',
        qty: 2,
        unitCost: 100,
        preVatAmount: 200,
        transactionDate: new Date('2026-06-01'),
        licensePlate: null,
        settlementOrder: null,
        isAdjustment: false,
        adjSign: 1,
      },
    ]);

    const result = await service.syncLedger({ progress$: progress });

    expect(ledgerRepo.save).not.toHaveBeenCalled();
    expect(result.updatedCount).toBe(0);
  });

  it('removes an old ledger row when its line no longer maps to a part', async () => {
    items = [
      itemRow({
        id: 'ii-9',
        itemCode: 'DV-SUACHUA',
        description: 'Công thay lốp',
        unit: 'Công',
        invoice: { ...itemRow({}).invoice, direction: 'OUT' },
      }),
    ];
    const stale = { id: 'l-9', invoiceItemId: 'ii-9', partSku: 'VF-50103501' };
    ledgerRepo.find.mockResolvedValue([stale]);

    const result = await service.syncLedger({ progress$: progress });

    expect(ledgerRepo.remove).toHaveBeenCalledWith(stale);
    expect(result.deletedCount).toBe(1);
  });

  it('skips lines whose catalog SKU is a service', async () => {
    items = [
      itemRow({
        id: 'ii-2',
        itemCode: 'VF-LFP00000216',
        description: 'LFP00000216 Chẩn đoán lỗi pin',
      }),
    ];

    await service.syncLedger({ progress$: progress });

    expect(ledgerRepo.save).not.toHaveBeenCalled();
  });

  it('reports progress by position over all lines, including skipped ones', async () => {
    items = Array.from({ length: 450 }, (_, n) =>
      itemRow({
        id: `ii-${n}`,
        itemCode: 'DV-SUACHUA',
        description: 'Công',
        unit: 'Công',
      }),
    );

    await service.syncLedger({ progress$: progress });

    const currents = progress.next.mock.calls
      .map((c) => c[0])
      .filter((e) => e.completed === false)
      .map((e) => e.current);
    expect(currents).toEqual([200, 400]);
    expect(progress.next.mock.calls.at(-1)[0]).toMatchObject({
      completed: true,
      current: 450,
      total: 450,
    });
  });
});
