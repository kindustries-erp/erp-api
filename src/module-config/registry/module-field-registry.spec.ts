import {
  getModuleFieldRegistry,
  isBuiltinOrLegacyCode,
} from './module-field-registry';

describe('module-field-registry', () => {
  it('đăng ký built-in cho GARAGE_CASE', () => {
    const entry = getModuleFieldRegistry('GARAGE_CASE');
    expect(entry?.builtin.map((f) => f.key)).toEqual([
      'categoryId',
      'excludeFromReports',
      'excludeFromDebt',
    ]);
  });

  it('module chưa đăng ký trả undefined', () => {
    expect(getModuleFieldRegistry('BOM')).toBeUndefined();
  });

  it('nhận diện code built-in và legacy, không nhận custom', () => {
    expect(isBuiltinOrLegacyCode('GARAGE_CASE', 'exclude_from_debt')).toBe(
      true,
    );
    expect(isBuiltinOrLegacyCode('GARAGE_CASE', 'excludeFromReports')).toBe(
      true,
    );
    expect(isBuiltinOrLegacyCode('GARAGE_CASE', 'ghi_chu_xe')).toBe(false);
    expect(isBuiltinOrLegacyCode('BOM', 'exclude_from_debt')).toBe(false);
  });
});
