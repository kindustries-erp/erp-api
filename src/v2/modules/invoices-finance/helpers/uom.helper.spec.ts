import { normalizeUom } from './uom.helper';

describe('normalizeUom', () => {
  it('trims, collapses spaces and uppercases', () => {
    expect(normalizeUom('  cái   bộ ')).toBe('CÁI BỘ');
  });

  it('returns null for empty or blank input', () => {
    expect(normalizeUom(null)).toBeNull();
    expect(normalizeUom('')).toBeNull();
    expect(normalizeUom('   ')).toBeNull();
  });
});
