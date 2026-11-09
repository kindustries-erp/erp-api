import { BadRequestException } from '@nestjs/common';
import {
  assertNoUnsafeExtraData,
  RejectUnsafeExtraDataPipe,
} from './reject-unsafe-extra-data.pipe';

const body = (json: string) => JSON.parse(json) as unknown;
const bodyMeta = { type: 'body' as const };

describe('RejectUnsafeExtraDataPipe', () => {
  const pipe = new RejectUnsafeExtraDataPipe();

  it('giữ nguyên body hợp lệ và body không có extraData', () => {
    const value = body('{"title":"a","lines":[{"qty":1}]}');
    expect(pipe.transform(value, bodyMeta)).toBe(value);
  });

  it('cho qua extraData hợp lệ ở header và ở dòng', () => {
    const value = body(
      '{"extraData":{"a":1},"lines":[{"extraData":{"b":{"c":2}}}]}',
    );
    expect(() => pipe.transform(value, bodyMeta)).not.toThrow();
  });

  it('chặn __proto__ trong extraData của header (400)', () => {
    expect(() =>
      pipe.transform(body('{"extraData":{"__proto__":{"x":1}}}'), bodyMeta),
    ).toThrow(BadRequestException);
  });

  it('chặn __proto__ trong extraData của dòng lồng trong mảng (400)', () => {
    expect(() =>
      pipe.transform(
        body('{"lines":[{"qty":1},{"extraData":{"__proto__":{}}}]}'),
        bodyMeta,
      ),
    ).toThrow(BadRequestException);
  });

  it('chặn extraData không phải object (400)', () => {
    expect(() => pipe.transform(body('{"extraData":[1]}'), bodyMeta)).toThrow(
      BadRequestException,
    );
  });

  it('bỏ qua metadata không phải body (query, param)', () => {
    const value = body('{"extraData":[1]}');
    expect(pipe.transform(value, { type: 'query' })).toBe(value);
  });

  it('không lỗi với chuỗi lồng rất sâu (duyệt không đệ quy)', () => {
    let deep: unknown = { ok: true };
    for (let i = 0; i < 20000; i++) deep = { n: deep };
    expect(() => assertNoUnsafeExtraData(deep)).not.toThrow();
  });
});
