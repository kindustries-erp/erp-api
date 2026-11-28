import {
  classifyInternalPqCase,
  toClassificationContext,
} from './kgara-internal-pq-classification.helper';

const august = new Date(2026, 7, 1);

describe('classifyInternalPqCase', () => {
  it('mốc 01/08/2026: trước mốc luôn là Sửa chữa chung, đúng mốc đã xét từ khóa', () => {
    const car = { brand: 'OMODA' };
    expect(
      classifyInternalPqCase({
        ...car,
        issuedAt: new Date(2026, 6, 31, 23, 59, 59),
      }),
    ).toBe('SUA_CHUA_CHUNG');
    expect(classifyInternalPqCase({ ...car, issuedAt: august })).toBe('OJ');
  });

  it('thiếu ngày phát sinh thì vẫn xét từ khóa', () => {
    expect(classifyInternalPqCase({ brand: 'Jaecoo', issuedAt: null })).toBe(
      'OJ',
    );
  });

  it.each(['OMODA', 'jaecoo', 'J5', 'J7', 'C5'])(
    'từ khóa %s ở dòng xe hoặc biển số là OJ',
    (keyword) => {
      expect(
        classifyInternalPqCase({ model: `Xe ${keyword}`, issuedAt: august }),
      ).toBe('OJ');
      expect(
        classifyInternalPqCase({
          plate: `${keyword} BEV 100032`,
          issuedAt: august,
        }),
      ).toBe('OJ');
    },
  );

  it.each(['CX-5', 'XC50', 'J70', 'AC5', 'OMODAX'])(
    'chỉ khớp nguyên từ: %s không phải OJ',
    (model) => {
      expect(classifyInternalPqCase({ model, issuedAt: august })).toBe(
        'SUA_CHUA_CHUNG',
      );
    },
  );

  it('chưa có hãng và dòng xe, biển số không có từ khóa thì để trống', () => {
    expect(
      classifyInternalPqCase({
        brand: ' ',
        model: '',
        plate: '51K74182',
        issuedAt: august,
      }),
    ).toBeNull();
  });
});

describe('toClassificationContext', () => {
  it('lấy hãng, dòng xe, biển số và ngày phát sinh của phiếu', () => {
    expect(
      toClassificationContext({
        hangXeName: 'OMODA',
        dongXeName: 'C5',
        bienSoXe: '51K74182',
        ngayPhatSinh: august,
      }),
    ).toEqual({
      brand: 'OMODA',
      model: 'C5',
      plate: '51K74182',
      issuedAt: august,
    });
  });
});
