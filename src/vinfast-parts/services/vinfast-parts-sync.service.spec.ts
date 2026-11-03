import { VinfastPartsSyncService } from './vinfast-parts-sync.service';

describe('VinfastPartsSyncService.syncCatalog service flag', () => {
  let service: VinfastPartsSyncService;
  let catalogRepo: any;
  let saved: any[];

  const buildInvoiceItemRepo = (rawItems: any[]) => {
    const qb: any = {};
    const chain = () => qb;
    qb.innerJoin = chain;
    qb.select = chain;
    qb.addSelect = chain;
    qb.where = chain;
    qb.andWhere = chain;
    qb.groupBy = chain;
    qb.getRawMany = jest.fn().mockResolvedValue(rawItems);
    return { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  };

  const run = async (rawItems: any[]) => {
    const invoiceItemRepo = buildInvoiceItemRepo(rawItems);
    service = new VinfastPartsSyncService(
      catalogRepo,
      { delete: jest.fn() } as any,
      invoiceItemRepo as any,
    );
    await service.syncCatalog();
  };

  beforeEach(() => {
    saved = [];
    catalogRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn((x) => {
        saved.push(x);
        return x;
      }),
      delete: jest.fn(),
    };
  });

  it('keeps a numeric code bought on a purchase invoice as a physical part', async () => {
    await run([
      {
        sku: 'VF-60103001',
        raw_description: '60103001 - Tháo lắp động cơ',
        uom: 'Chiếc',
      },
    ]);

    const item = saved.find((s) => s.sku === 'VF-60103001');
    expect(item).toBeDefined();
    expect(item.isService).toBe(false);
  });

  it('flags a service-prefix code bought on a purchase invoice as service', async () => {
    await run([
      {
        sku: 'VF-LFP00000216',
        raw_description: 'LFP00000216 Chẩn đoán lỗi pin',
        uom: 'Chiếc',
      },
    ]);

    const item = saved.find((s) => s.sku === 'VF-LFP00000216');
    expect(item).toBeDefined();
    expect(item.isService).toBe(true);
  });
});
