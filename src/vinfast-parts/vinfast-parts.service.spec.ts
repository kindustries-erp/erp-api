import { VinfastPartsService } from './vinfast-parts.service';

describe('VinfastPartsService Filter & Search Specs', () => {
  let service: VinfastPartsService;
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
        return Promise.resolve([
          {
            sku: 'EEP73110011AP',
            name: 'Pack Pin VF5',
            uom: 'Cái',
            qtyIn: '10',
            qtyOut: '3',
            qtyBalance: '7',
          },
        ]);
      }),
    };
    ledgerRepo = {};
    invoiceItemRepo = {};

    service = new VinfastPartsService(catalogRepo, ledgerRepo, invoiceItemRepo);
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
        JSON.stringify({ sku: '"EEP73110011AP"' }),
      );

      const calledParams = catalogRepo.query.mock.calls[0][1];
      expect(calledParams).toContain('EEP73110011AP');
      expect(calledParams).not.toContain('%EEP73110011AP%');
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
      const calledParams = catalogRepo.query.mock.calls[0][1];

      expect(calledQuery).toContain("(c.uom IS NULL OR c.uom = '')");
      expect(calledQuery).toContain('c.uom = ANY($');
      expect(calledParams).toContainEqual(['Chiếc']);
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
      expect(calledQuery).toContain('AND "qtyBalance" > 0');
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
      expect(calledQuery).toContain('AND "qtyBalance" = 0');
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
      expect(calledQuery).toContain('AND "qtyBalance" < 0');
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
      expect(calledQuery).not.toContain('AND "qtyBalance" > 0');
      expect(calledQuery).not.toContain('AND "qtyBalance" = 0');
      expect(calledQuery).not.toContain('AND "qtyBalance" < 0');
    });
  });

  describe('getStockColumnOptions with search & filters', () => {
    it('should apply multi-keyword search in getStockColumnOptions', async () => {
      const res = await service.getStockColumnOptions(
        'sku',
        'VF5;VF8',
        1,
        20,
        undefined,
        'oto',
      );

      expect(res.total).toBe(5);
      const calledParams = catalogRepo.query.mock.calls[0][1];
      expect(calledParams).toEqual(expect.arrayContaining(['%VF5%', '%VF8%']));
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
      expect(calledQuery).toContain('AND "qtyBalance" > 0');
    });
  });
});
