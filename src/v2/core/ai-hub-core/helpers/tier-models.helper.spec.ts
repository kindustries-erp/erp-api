import { isAiTier, parseTierModels, resolveTier } from './tier-models.helper';

describe('tier-models.helper', () => {
  it('đọc đúng các tier hợp lệ, bỏ key lạ và giá trị rỗng', () => {
    const raw = JSON.stringify({
      low: ' m-low ',
      medium: 'm-medium',
      high: '',
      turbo: 'x',
      ultra: 5,
    });
    expect(parseTierModels(raw)).toEqual({
      low: ['m-low'],
      medium: ['m-medium'],
    });
  });

  it('nhận mảng model dự phòng theo thứ tự, bỏ trùng và phần tử không hợp lệ', () => {
    const raw = JSON.stringify({
      low: ['a', ' b ', 'a', '', 3],
      high: [],
    });
    expect(parseTierModels(raw)).toEqual({ low: ['a', 'b'] });
  });

  it('trả {} khi rỗng, JSON hỏng hoặc không phải object', () => {
    expect(parseTierModels(undefined)).toEqual({});
    expect(parseTierModels('  ')).toEqual({});
    expect(parseTierModels('{low:')).toEqual({});
    expect(parseTierModels('["low"]')).toEqual({});
    expect(parseTierModels('"low"')).toEqual({});
  });

  it('resolveTier nhận tier hợp lệ, không phân biệt hoa thường', () => {
    expect(resolveTier(' HIGH ', 'low')).toBe('high');
    expect(resolveTier('gpt', 'low')).toBe('low');
    expect(resolveTier(undefined, 'medium')).toBe('medium');
  });

  it('isAiTier', () => {
    expect(isAiTier('ultra')).toBe(true);
    expect(isAiTier('max')).toBe(false);
  });
});
