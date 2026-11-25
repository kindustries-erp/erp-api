import { BadRequestException } from '@nestjs/common';
import {
  assertOjClassificationEdit,
  findOjCategoryId,
  isOjAccount,
  ojClassificationFields,
  withoutOjOverrides,
} from './case-oj-classification.helper';

describe('case-oj-classification.helper', () => {
  it('isOjAccount chỉ đúng với tài khoản OJ', () => {
    expect(isOjAccount('OJ')).toBe(true);
    expect(isOjAccount('MAIN')).toBe(false);
    expect(isOjAccount(null)).toBe(false);
  });

  it('findOjCategoryId tìm danh mục OJ của vụ việc garage, chưa xóa', async () => {
    const m = { findOne: jest.fn().mockResolvedValue({ id: 'cat-oj' }) };
    expect(await findOjCategoryId(m as never)).toBe('cat-oj');
    expect(m.findOne.mock.calls[0][1]).toEqual({
      where: { moduleKey: 'GARAGE_CASE', code: 'OJ', isDeleted: false },
    });
    m.findOne.mockResolvedValueOnce(null);
    expect(await findOjCategoryId(m as never)).toBeNull();
  });

  it('ojClassificationFields: luôn OJ; có danh mục thì gán, chưa có thì xóa categoryId', () => {
    expect(ojClassificationFields('cat-oj')).toEqual({
      classification: 'OJ',
      classificationManuallyCleared: false,
      categoryId: 'cat-oj',
    });
    expect(ojClassificationFields(null)).toHaveProperty('categoryId', null);
  });

  it('withoutOjOverrides chỉ bỏ khóa phân loại', () => {
    expect(
      withoutOjOverrides({
        classification: true,
        categoryId: true,
        classificationManuallyCleared: true,
        licensePlate: true,
      } as never),
    ).toEqual({ licensePlate: true });
  });

  it('assertOjClassificationEdit: xe OJ không đổi sang loại khác; gửi lại OJ thì qua; xe MAIN không chặn', () => {
    const bad = [
      { classification: 'BH' },
      { categoryId: 'cat-khac' },
      { categoryId: null },
      { classificationManuallyCleared: true },
    ];
    for (const p of bad) {
      expect(() => assertOjClassificationEdit('OJ', p, 'cat-oj')).toThrow(
        BadRequestException,
      );
    }
    expect(() =>
      assertOjClassificationEdit(
        'OJ',
        { classification: 'OJ', categoryId: 'cat-oj', licensePlate: 'x' },
        'cat-oj',
      ),
    ).not.toThrow();
    expect(() =>
      assertOjClassificationEdit('MAIN', { classification: 'BH' }, 'cat-oj'),
    ).not.toThrow();
    // Chưa có danh mục OJ: để trống được, gán danh mục khác thì không.
    expect(() =>
      assertOjClassificationEdit('OJ', { categoryId: null }, null),
    ).not.toThrow();
    expect(() =>
      assertOjClassificationEdit('OJ', { categoryId: 'cat-khac' }, null),
    ).toThrow(BadRequestException);
  });
});
