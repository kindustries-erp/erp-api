import { VinfastPartsService } from './vinfast-parts.service';
import { VinfastPartsStockService } from './services/vinfast-parts-stock.service';
import { VinfastPartsSyncService } from './services/vinfast-parts-sync.service';
import { VinfastPartsLedgerService } from './services/vinfast-parts-ledger.service';

describe('VinfastPartsService Filter & Search Specs', () => {
  let service: VinfastPartsService;
  let stockService: VinfastPartsStockService;
  let syncService: VinfastPartsSyncService;
  let ledgerService: VinfastPartsLedgerService;
  let catalogRepo: any;
  let ledgerRepo: any;
  let invoiceItemRepo: any;

  beforeEach(() => {
    catalogRepo = {
      query: jest.fn().mockImplementation((queryStr: string, params: any[]) => {
        if (queryStr.includes('COUNT(*) as total')) {
          return Promise.resolve([{ total: '10' }]);
        }
        if (queryStr.includes('COUNT(DISTINCT')) {
          return Promise.resolve([{ total: '5' }]);
        }
        if (queryStr.includes('totalQtyIn')) {
          return Promise.resolve([
            { totalQtyIn: '100', totalQtyOut: '30', totalQtyBalance: '70' },
          ]);
        }
        if (queryStr.includes('cumulativeQtyIn')) {
          return Promise.resolve([
            {
              cumulativeQtyIn: '50',
              cumulativeQtyOut: '15',
              cumulativeQtyBalance: '35',
            },
          ]);
        }
        return Promise.resolve([
          {
            sku: 'VF-EEP73110011AP',
            name: 'Pack Pin VF5',
            uom: 'Cái',
            qtyIn: '10',
            qtyOut: '3',
            qtyBalance: '7',
          },
        ]);
      }),
    };
    ledgerRepo = {
      query: jest.fn().mockResolvedValue([]),
    };
    invoiceItemRepo = {};

    stockService = new VinfastPartsStockService(catalogRepo);
    syncService = new VinfastPartsSyncService(
      catalogRepo,
      ledgerRepo,
      invoiceItemRepo,
    );
    ledgerService = new VinfastPartsLedgerService(ledgerRepo);

    service = new VinfastPartsService(
      syncService,
      stockService,
      ledgerService,
      ledgerRepo,
      catalogRepo,
    );
  });

  describe('resolveVinfastSku', () => {
    it('should correctly standardize VinFast SKU with VF- prefix', () => {
      expect(service.resolveVinfastSku(null, 'BIN20050001 - LỌC KHÍ')).toBe(
        'VF-BIN20050001',
      );
      expect(
        service.resolveVinfastSku('VF-BEX20001151', 'Cụm tấm ốp bậc'),
      ).toBe('VF-BEX20001151');
      expect(
        service.resolveVinfastSku(null, 'VF5_HV_BATTERY_PACK_38_KWH'),
      ).toBe('VF-EEP73110011AP');
    });
  });

  describe('getPartsStock with multi-keyword, exact, and blank filter', () => {
    it('should build multi-keyword OR condition with semicolon delimiter in column_search', async () => {
      await service.getPartsStock(
        'oto',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        JSON.stringify({ sku: 'AAA;BBB;CCC' }),
      );

      expect(catalogRepo.query).toHaveBeenCalled();
      const calledQuery = catalogRepo.query.mock.calls[0][0];
      const calledParams = catalogRepo.query.mock.calls[0][1];

      expect(calledQuery).toContain('c.sku ILIKE $');
      expect(calledParams).toEqual(
        expect.arrayContaining(['%AAA%', '%BBB%', '%CCC%']),
      );
    });

    it('should support exact search with quotes in column_search', async () => {
      await service.getPartsStock(
        'xemay',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        JSON.stringify({ sku: '"VF-EEP73110011AP"' }),
      );

      const calledParams = catalogRepo.query.mock.calls[0][1];
      expect(calledParams).toContain('VF-EEP73110011AP');
      expect(calledParams).not.toContain('%VF-EEP73110011AP%');
    });

    it('should support __BLANK__ in columnFilters and generate IS NULL OR empty check', async () => {
      await service.getPartsStock(
        'oto',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        JSON.stringify({ uom: ['Chiếc', '__BLANK__'] }),
      );

      const calledQuery = catalogRepo.query.mock.calls[0][0];
      expect(calledQuery).toContain("(c.uom IS NULL OR c.uom = '')");
    });
  });

  describe('getPartsStock with stockTab (IN_STOCK, OUT_OF_STOCK, NEGATIVE, ALL)', () => {
    it('should filter qtyBalance > 0 when stockTab is IN_STOCK', async () => {
      await service.getPartsStock(
        'oto',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'IN_STOCK',
      );

      const calledQuery = catalogRepo.query.mock.calls[0][0];
      expect(calledQuery).toContain('"qtyBalance" > 0');
    });

    it('should filter qtyBalance = 0 when stockTab is OUT_OF_STOCK', async () => {
      await service.getPartsStock(
        'oto',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'OUT_OF_STOCK',
      );

      const calledQuery = catalogRepo.query.mock.calls[0][0];
      expect(calledQuery).toContain('"qtyBalance" = 0');
    });

    it('should filter qtyBalance < 0 when stockTab is NEGATIVE', async () => {
      await service.getPartsStock(
        'oto',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'NEGATIVE',
      );

      const calledQuery = catalogRepo.query.mock.calls[0][0];
      expect(calledQuery).toContain('"qtyBalance" < 0');
    });

    it('should not add stock filter when stockTab is ALL or undefined', async () => {
      await service.getPartsStock(
        'oto',
        1,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'ALL',
      );

      const calledQuery = catalogRepo.query.mock.calls[0][0];
      expect(calledQuery).not.toContain('"qtyBalance" > 0');
      expect(calledQuery).not.toContain('"qtyBalance" = 0');
      expect(calledQuery).not.toContain('"qtyBalance" < 0');
    });
  });

  describe('getStockColumnOptions with search & filters', () => {
    it('should apply multi-keyword search in getStockColumnOptions', async () => {
      await service.getStockColumnOptions(
        'name',
        'LỌC;DẦU',
        1,
        20,
        undefined,
        'oto',
      );

      expect(catalogRepo.query).toHaveBeenCalled();
      const calledQuery = catalogRepo.query.mock.calls[0][0];
      const calledParams = catalogRepo.query.mock.calls[0][1];

      expect(calledQuery).toContain('c.name ILIKE $');
      expect(calledParams).toEqual(expect.arrayContaining(['%LỌC%', '%DẦU%']));
    });

    it('should apply stockTab filter in getStockColumnOptions', async () => {
      await service.getStockColumnOptions(
        'sku',
        undefined,
        1,
        20,
        undefined,
        'oto',
        'IN_STOCK',
      );

      const calledQuery = catalogRepo.query.mock.calls[0][0];
      expect(calledQuery).toContain('"qtyBalance" > 0');
    });
  });

  describe('getPartsStock summary and cumulative totals', () => {
    it('should return totalQtyIn, totalQtyOut, totalQtyBalance and local cumulative on page 1', async () => {
      const result = await service.getPartsStock('oto', 1, 20);

      expect(result.summary).toEqual({
        totalQtyIn: 100,
        totalQtyOut: 30,
        totalQtyBalance: 70,
      });

      expect(result.cumulative).toEqual({
        cumulativeQtyIn: 10,
        cumulativeQtyOut: 3,
        cumulativeQtyBalance: 7,
      });
    });

    it('should calculate cumulative totals via query on page > 1 and page < totalPages', async () => {
      const result = await service.getPartsStock('oto', 2, 2);

      expect(result.cumulative).toEqual({
        cumulativeQtyIn: 50,
        cumulativeQtyOut: 15,
        cumulativeQtyBalance: 35,
      });
    });
  });
});
