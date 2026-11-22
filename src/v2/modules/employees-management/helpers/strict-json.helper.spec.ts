import { BadRequestException } from '@nestjs/common';
import { parseStrictJsonParam } from './strict-json.helper';

describe('parseStrictJsonParam', () => {
  it('trả undefined khi rỗng', () => {
    expect(parseStrictJsonParam(undefined, 'p')).toBeUndefined();
    expect(parseStrictJsonParam('', 'p')).toBeUndefined();
    expect(parseStrictJsonParam(null, 'p')).toBeUndefined();
  });

  it('parse JSON object hợp lệ', () => {
    expect(parseStrictJsonParam('{"a":["x"]}', 'p')).toEqual({ a: ['x'] });
  });

  it('nhận object đã parse sẵn', () => {
    expect(parseStrictJsonParam({ a: 1 }, 'p')).toEqual({ a: 1 });
  });

  it('JSON sai trả 400 và nêu tên tham số', () => {
    expect(() => parseStrictJsonParam('{bad', 'column_filters')).toThrow(
      BadRequestException,
    );
    expect(() => parseStrictJsonParam('{bad', 'column_filters')).toThrow(
      /column_filters/,
    );
  });

  it('mảng hoặc giá trị nguyên thủy trả 400', () => {
    expect(() => parseStrictJsonParam('[1]', 'p')).toThrow(BadRequestException);
    expect(() => parseStrictJsonParam('5', 'p')).toThrow(BadRequestException);
  });
});
