import { BadRequestException } from '@nestjs/common';
import {
  assertValidExtraData,
  explainExtraDataError,
  EXTRA_DATA_MAX_BYTES,
  EXTRA_DATA_MAX_DEPTH,
  mergeExtraData,
} from './extra-data.util';

describe('extra-data.util', () => {
  describe('explainExtraDataError', () => {
    it('chấp nhận object phẳng và lồng trong giới hạn', () => {
      expect(
        explainExtraDataError({ a: 1, b: 'x', c: { d: [1, 2] } }),
      ).toBeNull();
      expect(explainExtraDataError({})).toBeNull();
    });

    it('từ chối không phải object', () => {
      expect(explainExtraDataError(null)).not.toBeNull();
      expect(explainExtraDataError([1])).not.toBeNull();
      expect(explainExtraDataError('x')).not.toBeNull();
      expect(explainExtraDataError(3)).not.toBeNull();
    });

    it('từ chối quá dung lượng', () => {
      const big = { payload: 'x'.repeat(EXTRA_DATA_MAX_BYTES) };
      expect(explainExtraDataError(big)).toMatch(/vượt/);
    });

    it('từ chối quá sâu', () => {
      let node: Record<string, unknown> = { leaf: true };
      for (let i = 0; i < EXTRA_DATA_MAX_DEPTH + 2; i += 1) {
        node = { next: node };
      }
      expect(explainExtraDataError(node)).toMatch(/sâu quá/);
    });

    it('từ chối key dài quá 64 ký tự', () => {
      expect(explainExtraDataError({ ['k'.repeat(65)]: 1 })).toMatch(/64/);
    });

    it('từ chối key bị cấm, kể cả lồng sâu', () => {
      expect(explainExtraDataError({ constructor: 1 })).toMatch(
        /không được phép/,
      );
      expect(explainExtraDataError({ a: { prototype: 1 } })).toMatch(
        /không được phép/,
      );
    });
  });

  describe('assertValidExtraData', () => {
    it('ném BadRequestException khi không hợp lệ', () => {
      expect(() => assertValidExtraData('bad')).toThrow(BadRequestException);
    });

    it('không ném khi hợp lệ', () => {
      expect(() => assertValidExtraData({ ok: true })).not.toThrow();
    });
  });

  describe('mergeExtraData', () => {
    it('giữ key không có trong patch (tương thích client cũ)', () => {
      expect(mergeExtraData({ a: 1, b: 2 }, {})).toEqual({ a: 1, b: 2 });
    });

    it('ghi đè key trùng và thêm key mới', () => {
      expect(mergeExtraData({ a: 1 }, { a: 9, c: 3 })).toEqual({ a: 9, c: 3 });
    });

    it('giá trị null xóa key', () => {
      expect(mergeExtraData({ a: 1, b: 2 }, { a: null })).toEqual({ b: 2 });
    });

    it('xử lý current null/undefined như object rỗng', () => {
      expect(mergeExtraData(null, { a: 1 })).toEqual({ a: 1 });
      expect(mergeExtraData(undefined, { a: 1 })).toEqual({ a: 1 });
    });

    it('không đổi object gốc', () => {
      const current = { a: 1 };
      mergeExtraData(current, { a: 2 });
      expect(current).toEqual({ a: 1 });
    });
  });
});
