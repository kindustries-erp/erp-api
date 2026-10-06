import { normalizeUom } from './uom.helper';

describe('uom.helper - normalizeUom', () => {
  it('should return null for null, undefined or empty string', () => {
    expect(normalizeUom(null)).toBeNull();
    expect(normalizeUom(undefined)).toBeNull();
    expect(normalizeUom('')).toBeNull();
    expect(normalizeUom('   ')).toBeNull();
  });

  it('should convert standard lowercase units to uppercase', () => {
    expect(normalizeUom('cái')).toBe('CÁI');
    expect(normalizeUom('bộ')).toBe('BỘ');
    expect(normalizeUom('chiếc')).toBe('CHIẾC');
    expect(normalizeUom('lần')).toBe('LẦN');
    expect(normalizeUom('bình')).toBe('BÌNH');
    expect(normalizeUom('lon')).toBe('LON');
    expect(normalizeUom('chai')).toBe('CHAI');
    expect(normalizeUom('kg')).toBe('KG');
    expect(normalizeUom('can')).toBe('CAN');
    expect(normalizeUom('chuyến')).toBe('CHUYẾN');
  });

  it('should handle multi-word units with accents and extra spaces', () => {
    expect(normalizeUom('  gói   dịch vụ  ')).toBe('GÓI DỊCH VỤ');
    expect(normalizeUom('giờ công')).toBe('GIỜ CÔNG');
    expect(normalizeUom('bình 500ml')).toBe('BÌNH 500ML');
  });

  it('should preserve already uppercase units', () => {
    expect(normalizeUom('CÁI')).toBe('CÁI');
    expect(normalizeUom('BỘ')).toBe('BỘ');
    expect(normalizeUom('SET')).toBe('SET');
  });
});
