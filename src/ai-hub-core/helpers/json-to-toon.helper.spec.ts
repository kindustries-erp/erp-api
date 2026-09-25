import { jsonToToon } from './json-to-toon.helper';

describe('jsonToToon (Universal TOON Serializer)', () => {
  describe('1. Primitives & Basic Types', () => {
    it('should handle null and undefined', () => {
      expect(jsonToToon(null)).toBe('null');
      expect(jsonToToon(undefined)).toBe('null');
    });

    it('should handle string, number, and boolean', () => {
      expect(jsonToToon('Hello World')).toBe('Hello World');
      expect(jsonToToon(123456)).toBe('123456');
      expect(jsonToToon(true)).toBe('true');
      expect(jsonToToon(false)).toBe('false');
    });

    it('should format Date instance as ISO string', () => {
      const date = new Date('2026-09-25T08:00:00.000Z');
      expect(jsonToToon(date)).toBe('2026-09-25T08:00:00.000Z');
    });
  });

  describe('2. Flat & Nested Objects', () => {
    it('should serialize simple flat object', () => {
      const obj = { name: 'VinFast VF5', price: 500000000, inStock: true };
      const result = jsonToToon(obj);
      expect(result).toBe('name: VinFast VF5\nprice: 500000000\ninStock: true');
    });

    it('should serialize multi-level nested objects with indentation', () => {
      const obj = {
        invoiceNo: '1618',
        buyer: {
          name: 'Công ty DBV',
          address: {
            street: '12 Đào Trí',
            city: 'TP.HCM',
          },
        },
      };

      const expected = [
        'invoiceNo: 1618',
        'buyer:',
        '  name: Công ty DBV',
        '  address:',
        '    street: 12 Đào Trí',
        '    city: TP.HCM',
      ].join('\n');

      expect(jsonToToon(obj)).toBe(expected);
    });

    it('should skip null and undefined fields by default (skipNulls: true)', () => {
      const obj = {
        id: '123',
        description: 'Test note',
        notes: null,
        extra: undefined,
      };

      expect(jsonToToon(obj)).toBe('id: 123\ndescription: Test note');
    });

    it('should retain null fields if skipNulls is false', () => {
      const obj = { id: '123', notes: null };
      expect(jsonToToon(obj, 0, { skipNulls: false })).toBe(
        'id: 123\nnotes: null',
      );
    });
  });

  describe('3. Arrays Handling', () => {
    it('should format empty array as []', () => {
      expect(jsonToToon([])).toBe('[]');
      expect(jsonToToon({ items: [] })).toBe('items: []');
    });

    it('should format primitive array on single line', () => {
      const obj = {
        tags: ['VIP', 'AUTO_MATCH', 'TAX_2026'],
        numbers: [1, 2, 3],
      };
      const expected = [
        'tags: [VIP, AUTO_MATCH, TAX_2026]',
        'numbers: [1, 2, 3]',
      ].join('\n');

      expect(jsonToToon(obj)).toBe(expected);
    });

    it('should format uniform shallow object array as Tabular TOON with schema header', () => {
      const data = {
        invoiceNo: '1736',
        items: [
          { name: 'Sơn cản sau', qty: 1, amount: 972000 },
          { name: 'Đèn hậu phải', qty: 1, amount: 4615000 },
        ],
      };

      const expected = [
        'invoiceNo: 1736',
        'items[name,qty,amount]:',
        '  - Sơn cản sau | 1 | 972000',
        '  - Đèn hậu phải | 1 | 4615000',
      ].join('\n');

      expect(jsonToToon(data)).toBe(expected);
    });

    it('should handle heterogeneous / deeply nested arrays by recursing list items', () => {
      const data = {
        packages: [
          { pkgName: 'Pkg1', details: { weightKg: 10 } },
          { pkgName: 'Pkg2', details: { weightKg: 20 } },
        ],
      };

      const result = jsonToToon(data);
      expect(result).toContain('packages:');
      expect(result).toContain('pkgName: Pkg1');
      expect(result).toContain('weightKg: 10');
    });
  });

  describe('4. Sanitization & Edge Cases', () => {
    it('should sanitize newlines and pipe characters inside table column values', () => {
      const data = {
        items: [{ name: 'Sơn cản | bóng\nPhần 1', qty: 1, amount: 500000 }],
      };

      const result = jsonToToon(data);
      expect(result).toBe(
        'items[name,qty,amount]:\n  - Sơn cản   bóng Phần 1 | 1 | 500000',
      );
    });

    it('should handle custom delimiter and indent size', () => {
      const data = {
        items: [{ code: 'A', val: 10 }],
      };

      const result = jsonToToon(data, 0, { indentSize: 4, delimiter: ' ; ' });
      expect(result).toBe('items[code,val]:\n    - A ; 10');
    });
  });
});
