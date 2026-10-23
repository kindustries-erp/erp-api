import { getModuleFieldRegistry, isBuiltinCode } from './module-field-registry';

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

  it('nhận diện code built-in (key hoặc cột), không nhận custom', () => {
    expect(isBuiltinCode('GARAGE_CASE', 'exclude_from_debt')).toBe(true);
    expect(isBuiltinCode('GARAGE_CASE', 'exclude_from_reports')).toBe(true);
    expect(isBuiltinCode('GARAGE_CASE', 'excludeFromReports')).toBe(true);
    expect(isBuiltinCode('GARAGE_CASE', 'ghi_chu_xe')).toBe(false);
    expect(isBuiltinCode('BOM', 'exclude_from_debt')).toBe(false);
  });
});
