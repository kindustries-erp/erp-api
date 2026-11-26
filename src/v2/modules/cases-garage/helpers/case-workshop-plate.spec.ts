import { escapeLike, normalizePlate } from './case-workshop-plate';

describe('normalizePlate', () => {
  it('bỏ dấu gạch, chấm, cách và viết hoa', () => {
    expect(normalizePlate('51g-123.45')).toBe('51G12345');
    expect(normalizePlate(' 30A 999 99 ')).toBe('30A99999');
  });

  it('null hoặc rỗng → chuỗi rỗng', () => {
    expect(normalizePlate(null)).toBe('');
    expect(normalizePlate('-.-')).toBe('');
  });
});

describe('escapeLike', () => {
  it('thoát %, _ và dấu gạch ngược', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
    expect(escapeLike('51G-123')).toBe('51G-123');
  });
});
