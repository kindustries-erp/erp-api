import {
  AiJsonParseError,
  parseAiJson,
  toAiNumber,
  toAiText,
} from './ai-json.helper';

describe('ai-json.helper', () => {
  it('đọc JSON trần, JSON trong fence và JSON có lời dẫn', () => {
    expect(parseAiJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseAiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAiJson('Kết quả: {"a":{"b":2}} hết.')).toEqual({
      a: { b: 2 },
    });
  });

  it('ném AiJsonParseError khi rỗng, không có object hoặc JSON hỏng', () => {
    expect(() => parseAiJson('')).toThrow(AiJsonParseError);
    expect(() => parseAiJson('xin lỗi')).toThrow(AiJsonParseError);
    expect(() => parseAiJson('{"a":}')).toThrow(AiJsonParseError);
  });

  it('toAiNumber hiểu định dạng số Việt Nam và quốc tế', () => {
    expect(toAiNumber(12.5)).toBe(12.5);
    expect(toAiNumber('1.234.567')).toBe(1234567);
    expect(toAiNumber('1.234,5')).toBe(1234.5);
    expect(toAiNumber('1,234.5')).toBe(1234.5);
    expect(toAiNumber('12.000')).toBe(12000);
    expect(toAiNumber('2,5')).toBe(2.5);
    expect(toAiNumber('2.50')).toBe(2.5);
    expect(toAiNumber('120 000 đ')).toBe(120000);
    expect(toAiNumber('abc')).toBeNull();
    expect(toAiNumber(null)).toBeNull();
  });

  it('toAiText gộp khoảng trắng và cắt độ dài', () => {
    expect(toAiText('  Dầu   nhớt \n 5W30 ')).toBe('Dầu nhớt 5W30');
    expect(toAiText('abcdef', 3)).toBe('abc');
    expect(toAiText({})).toBe('');
  });
});
