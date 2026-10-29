import {
  buildMetadataFillPatch,
  buildPortalHeaderPatch,
  matchPortalItems,
  normalizeItemKey,
} from './portal-detail-merge.helper';

describe('portal-detail-merge.helper', () => {
  describe('buildPortalHeaderPatch', () => {
    it('returns only GDT-owned fields whose value changed', () => {
      const current = {
        buyerName: 'Cty A',
        totalAmount: '1000.00',
        notes: 'ghi chú tay',
        categoryId: 'cat-1',
      };
      const portal = {
        buyerName: 'Cty B',
        totalAmount: 1000,
        notes: 'GDT không có field này',
        categoryId: 'cat-gdt',
      };

      expect(buildPortalHeaderPatch(current, portal)).toEqual({
        buyerName: 'Cty B',
      });
    });

    it('does not erase existing data when GDT sends null or undefined', () => {
      const current = { buyerTaxCode: '0101', sellerAddress: 'Hà Nội' };
      const portal = { buyerTaxCode: null, sellerAddress: undefined };

      expect(buildPortalHeaderPatch(current, portal)).toEqual({});
    });

    it('compares numeric columns by value, not by string form', () => {
      const current = { vatAmount: '50000.00' };
      expect(buildPortalHeaderPatch(current, { vatAmount: 50000 })).toEqual({});
      expect(buildPortalHeaderPatch(current, { vatAmount: 60000 })).toEqual({
        vatAmount: 60000,
      });
    });
  });

  describe('matchPortalItems', () => {
    it('keeps matched row ids and only reports changed GDT fields', () => {
      const existing = [
        { id: 'row-1', description: 'Lọc dầu', quantity: '1', itemCode: 'X' },
      ];
      const portal = [{ description: 'Lọc dầu', quantity: 2, unit: 'cái' }];

      const result = matchPortalItems(existing, portal);

      expect(result.inserts).toEqual([]);
      expect(result.deletes).toEqual([]);
      expect(result.updates).toEqual([
        { id: 'row-1', patch: { quantity: 2, unit: 'cái' } },
      ]);
    });

    it('matches by normalized description and takes GDT spelling', () => {
      const existing = [{ id: 'row-1', description: '  Lọc   DẦU ' }];
      const portal = [{ description: 'lọc dầu' }];

      const result = matchPortalItems(existing, portal);

      expect(result.inserts).toEqual([]);
      expect(result.deletes).toEqual([]);
      expect(result.updates).toEqual([
        { id: 'row-1', patch: { description: 'lọc dầu' } },
      ]);
    });

    it('pairs duplicate descriptions in order', () => {
      const existing = [
        { id: 'row-1', description: 'Bu lông', quantity: '1' },
        { id: 'row-2', description: 'Bu lông', quantity: '5' },
      ];
      const portal = [
        { description: 'Bu lông', quantity: 1 },
        { description: 'Bu lông', quantity: 7 },
      ];

      const result = matchPortalItems(existing, portal);

      expect(result.updates).toEqual([{ id: 'row-2', patch: { quantity: 7 } }]);
      expect(result.deletes).toEqual([]);
    });

    it('returns new GDT rows as inserts and rows missing from GDT as deletes', () => {
      const existing = [
        { id: 'row-1', description: 'Cũ không còn' },
        { id: 'row-2', description: 'Giữ lại' },
      ];
      const portal = [
        { description: 'Giữ lại' },
        { description: 'Mới thêm', quantity: 3 },
      ];

      const result = matchPortalItems(existing, portal);

      expect(result.inserts).toEqual([
        { description: 'Mới thêm', quantity: 3 },
      ]);
      expect(result.deletes).toEqual(['row-1']);
      expect(result.updates).toEqual([]);
    });
  });

  describe('buildMetadataFillPatch', () => {
    it('fills settlementOrder and licensePlate when they are empty', () => {
      const patch = buildMetadataFillPatch(
        { description: 'Sửa xe 50H-319.73 theo GR-123', notes: null },
        [{ description: 'Thay dầu' }],
      );

      expect(patch.licensePlate).toBe('50H-319.73');
      expect(patch.settlementOrder).toBe('GR-123');
    });

    it('never overwrites a value that is already set', () => {
      const patch = buildMetadataFillPatch(
        {
          description: 'Sửa xe 50H-319.73 theo GR-123',
          settlementOrder: 'WO-MANUAL',
          licensePlate: '29A-111.11',
        },
        [],
      );

      expect(patch).toEqual({});
    });
  });

  describe('normalizeItemKey', () => {
    it('trims, collapses spaces and lowercases', () => {
      expect(normalizeItemKey('  Lọc   DẦU  ')).toBe('lọc dầu');
    });

    it('treats null and undefined as empty key', () => {
      expect(normalizeItemKey(null)).toBe('');
      expect(normalizeItemKey(undefined)).toBe('');
    });
  });
});
