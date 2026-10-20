import {
  parseCategoryResult,
  parseExtractedInvoice,
  parseLineItemsResult,
  parsePlateResult,
  stripJsonFence,
} from './invoice-ai.parsers';

describe('invoice-ai.parsers', () => {
  describe('stripJsonFence', () => {
    it('removes markdown json fences', () => {
      expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });
  });

  describe('parseCategoryResult', () => {
    it('accepts a valid category with confidence >= 0.7', () => {
      const r = parseCategoryResult(
        '{"categoryCode":"OPEX_LOGISTICS","confidence":0.9,"reason":"grab"}',
      );
      expect(r).toEqual({
        categoryCode: 'OPEX_LOGISTICS',
        confidence: 0.9,
        reason: 'grab',
      });
    });

    it('returns null category when confidence < 0.7', () => {
      const r = parseCategoryResult(
        '{"categoryCode":"OPEX_LOGISTICS","confidence":0.5,"reason":"unsure"}',
      );
      expect(r.categoryCode).toBeNull();
      expect(r.confidence).toBe(0.5);
      expect(r.reason).toBe('unsure');
      expect(r.fallbackReason).toBe('LOW_CONFIDENCE');
    });

    it('returns null category for a code outside the 14 standard codes', () => {
      const r = parseCategoryResult(
        '{"categoryCode":"MADE_UP","confidence":0.99}',
      );
      expect(r.categoryCode).toBeNull();
      expect(r.fallbackReason).toBe('INVALID_CODE');
    });

    it('does not set fallbackReason on an accepted result', () => {
      const r = parseCategoryResult(
        '{"categoryCode":"OPEX_ADMIN","confidence":0.8}',
      );
      expect(r.fallbackReason).toBeUndefined();
    });

    it('is safe on unparseable text and reports through warn callback', () => {
      const warn = jest.fn();
      const r = parseCategoryResult('not json', warn);
      expect(r).toEqual({
        categoryCode: null,
        confidence: 0,
        reason: 'Unparseable AI response JSON',
        fallbackReason: 'AI_ERROR',
      });
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('parsePlateResult', () => {
    it('parses plate fields with defaults', () => {
      const r = parsePlateResult('{"licensePlate":"50H-319.73"}');
      expect(r.licensePlate).toBe('50H-319.73');
      expect(r.formattedPlate).toBe('50H-319.73');
      expect(r.confidence).toBe(0.9);
    });

    it('falls back gracefully on bad JSON', () => {
      const r = parsePlateResult('oops');
      expect(r.licensePlate).toBeNull();
      expect(r.confidence).toBe(0);
      expect(r.reason).toBe('oops');
    });
  });

  describe('parseExtractedInvoice', () => {
    it('parses fenced JSON', () => {
      const r = parseExtractedInvoice(
        '```json\n{"items":[],"invoiceNumber":"1"}\n```',
      );
      expect(r.invoiceNumber).toBe('1');
    });

    it('returns empty items and rawSummary on bad JSON', () => {
      const r = parseExtractedInvoice('bad');
      expect(r).toEqual({ items: [], rawSummary: 'bad' });
    });
  });

  describe('parseLineItemsResult', () => {
    const original = [{ lineIndex: 7 }];

    it('normalizes item code, type and discount flag', () => {
      const r = parseLineItemsResult(
        '{"items":[{"lineIndex":3,"itemCode":" VF-X ","itemType":"DISCOUNT","confidence":0.95}]}',
        original,
      );
      expect(r).toEqual([
        {
          lineIndex: 3,
          itemCode: 'VF-X',
          itemType: 'DISCOUNT',
          isDiscountDeduction: true,
          confidence: 0.95,
          reason: 'Classified by 9router AI',
        },
      ]);
    });

    it('uses the original lineIndex and OTHER type when missing/invalid', () => {
      const r = parseLineItemsResult(
        '[{"itemCode":"","itemType":"WHATEVER"}]',
        original,
      );
      expect(r[0].lineIndex).toBe(7);
      expect(r[0].itemCode).toBeNull();
      expect(r[0].itemType).toBe('OTHER');
      expect(r[0].confidence).toBe(0.8);
    });

    it('returns [] on unparseable JSON', () => {
      expect(parseLineItemsResult('nope', original)).toEqual([]);
    });
  });
});
