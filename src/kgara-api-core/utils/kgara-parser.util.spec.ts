import {
  parseSafeDate,
  extractNetPayableAmount,
  extractKgaraClassification,
  mapKgaraClassificationToErp,
  pickNonEmpty,
  resolveStoredRevenue,
  resolveStoredNetPayable,
  toTrimmedOrNull,
  toModelYearOrNull,
} from './kgara-parser.util';

describe('pickNonEmpty', () => {
  it('ghi giá trị mới khi không rỗng (có trim)', () => {
    expect(pickNonEmpty('  51L50338 ', 'OLD')).toBe('51L50338');
  });

  it('giữ giá trị cũ khi giá trị mới rỗng hoặc null/undefined', () => {
    expect(pickNonEmpty('', 'KEEP')).toBe('KEEP');
    expect(pickNonEmpty('   ', 'KEEP')).toBe('KEEP');
    expect(pickNonEmpty(undefined, 'KEEP')).toBe('KEEP');
    expect(pickNonEmpty(null, 'KEEP')).toBe('KEEP');
  });

  it('trả null khi cả hai đều rỗng', () => {
    expect(pickNonEmpty('', null)).toBeNull();
    expect(pickNonEmpty(undefined, undefined)).toBeNull();
  });
});

describe('toModelYearOrNull', () => {
  it('nhận số hoặc chuỗi 4 chữ số trong khoảng 1900-2099', () => {
    expect(toModelYearOrNull(2019)).toBe(2019);
    expect(toModelYearOrNull(' 2024 ')).toBe(2024);
  });
  it('trả null với 0, rác, ngoài khoảng, rỗng', () => {
    for (const v of [
      0,
      '0',
      1800,
      2500,
      20.5,
      'abc',
      '',
      null,
      undefined,
      '19999',
    ])
      expect(toModelYearOrNull(v)).toBeNull();
  });
});

describe('toTrimmedOrNull', () => {
  it('trim và trả null cho chuỗi rỗng', () => {
    expect(toTrimmedOrNull(' BH-MIC ')).toBe('BH-MIC');
    expect(toTrimmedOrNull('')).toBeNull();
    expect(toTrimmedOrNull('   ')).toBeNull();
    expect(toTrimmedOrNull(undefined)).toBeNull();
  });
});

describe('kgara-parser.util', () => {
  describe('extractKgaraClassification', () => {
    it('should extract classification name and code from rawData', () => {
      const item = {
        rawData: {
          NguonGocKhachHangCode: 'NBPQ',
          NguonGocKhachHangName: 'Nội Bộ PQ',
        },
      };
      const result = extractKgaraClassification(item);
      expect(result).toEqual({
        kgaraClassification: 'Nội Bộ PQ',
        kgaraClassificationCode: 'NBPQ',
      });
    });

    it('should extract classification when placed at root level', () => {
      const item = {
        NguonGocKhachHangCode: 'KY GUI',
        NguonGocKhachHangName: 'Xe ký gửi',
      };
      const result = extractKgaraClassification(item);
      expect(result).toEqual({
        kgaraClassification: 'Xe ký gửi',
        kgaraClassificationCode: 'KY GUI',
      });
    });

    it('should return nulls when no classification fields present', () => {
      const item = { rawData: {} };
      const result = extractKgaraClassification(item);
      expect(result).toEqual({
        kgaraClassification: null,
        kgaraClassificationCode: null,
      });
    });

    it('should handle null/undefined item gracefully', () => {
      expect(extractKgaraClassification(null)).toEqual({
        kgaraClassification: null,
        kgaraClassificationCode: null,
      });
    });
  });

  describe('mapKgaraClassificationToErp', () => {
    const august = new Date(2026, 7, 1);
    const nbpq = (vehicle: Parameters<typeof mapKgaraClassificationToErp>[2]) =>
      mapKgaraClassificationToErp('NBPQ', 'Nội Bộ PQ', vehicle);

    it('NBPQ trước 01/08/2026 là Sửa chữa chung, kể cả xe Omoda', () => {
      expect(
        nbpq({ brand: 'OMODA', issuedAt: new Date(2026, 6, 31, 23, 59) }),
      ).toBe('SUA_CHUA_CHUNG');
    });

    it('NBPQ từ 01/08/2026, xe có từ khóa ở hãng, dòng xe hoặc biển số là OJ', () => {
      expect(nbpq({ brand: 'OMODA', issuedAt: august })).toBe('OJ');
      expect(nbpq({ brand: 'Jaecoo', issuedAt: august })).toBe('OJ');
      expect(nbpq({ brand: 'KHAC', model: 'J7 PHEV', issuedAt: august })).toBe(
        'OJ',
      );
      expect(nbpq({ model: 'Omoda C5', issuedAt: august })).toBe('OJ');
      expect(nbpq({ plate: 'J5 BEV 100032', issuedAt: august })).toBe('OJ');
    });

    it('nhận NBPQ qua tên khi thiếu mã', () => {
      const car = { brand: 'OMODA', issuedAt: august };
      expect(mapKgaraClassificationToErp('', 'Nội Bộ PQ', car)).toBe('OJ');
      expect(mapKgaraClassificationToErp('', 'NOI BO PQ', car)).toBe('OJ');
      expect(mapKgaraClassificationToErp('nbpq', '', car)).toBe('OJ');
    });

    it('NBPQ, có thông tin xe nhưng không có từ khóa là Sửa chữa chung', () => {
      expect(nbpq({ brand: 'MAZDA', model: 'CX-5', issuedAt: august })).toBe(
        'SUA_CHUA_CHUNG',
      );
      expect(nbpq({ model: 'XC50', plate: '51K74182', issuedAt: august })).toBe(
        'SUA_CHUA_CHUNG',
      );
      expect(nbpq({ brand: 'TOYOTA', plate: '29C5-1234' })).toBe(
        'SUA_CHUA_CHUNG',
      );
    });

    it('NBPQ chưa có hãng, dòng xe và biển số không có từ khóa thì để trống', () => {
      expect(nbpq({ plate: '51K74182', issuedAt: august })).toBeNull();
      expect(nbpq({ brand: '  ', model: null, issuedAt: august })).toBeNull();
      expect(nbpq({})).toBeNull();
    });

    it('should map Sales tặng to KHAC', () => {
      expect(mapKgaraClassificationToErp('Sales tặng', 'Sales tặng', {})).toBe(
        'KHAC',
      );
      expect(mapKgaraClassificationToErp('SALES', 'Tặng khách', {})).toBe(
        'KHAC',
      );
      expect(mapKgaraClassificationToErp('', 'Sales tặng', {})).toBe('KHAC');
      expect(mapKgaraClassificationToErp('', 'SALES TANG', {})).toBe('KHAC');
    });

    it('should map other KGara classifications to KY_GUI_NOI_BO', () => {
      expect(mapKgaraClassificationToErp('Ký gửi NSG', 'Ký gửi NSG', {})).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('KY GUI', 'Xe ký gửi', {})).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('Ký gửi PQ', 'Ký gửi PQ', {})).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('KG-NB', 'Ký gửi / Nội bộ', {})).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('UNKNOWN_CODE', 'Khách lạ', {})).toBe(
        'KY_GUI_NOI_BO',
      );
    });

    it('should return null when both code and name are empty', () => {
      expect(mapKgaraClassificationToErp(null, null, {})).toBeNull();
      expect(
        mapKgaraClassificationToErp(null, null, { brand: 'OMODA' }),
      ).toBeNull();
      expect(mapKgaraClassificationToErp('', '', {})).toBeNull();
      expect(mapKgaraClassificationToErp('   ', '   ', {})).toBeNull();
    });
  });
});

describe('resolveStoredRevenue', () => {
  const listRowWithoutDiscount = { TienCoThue: 6500000 };

  it('keeps the stored net amount when the list row has no discount fields', () => {
    expect(resolveStoredRevenue(5850000, listRowWithoutDiscount, 6500000)).toBe(
      5850000,
    );
  });

  it('uses the list amount for a new case (nothing stored yet)', () => {
    expect(
      resolveStoredRevenue(undefined, listRowWithoutDiscount, 6500000),
    ).toBe(6500000);
    expect(resolveStoredRevenue(null, listRowWithoutDiscount, 6500000)).toBe(
      6500000,
    );
  });

  it('uses the computed net amount when the list row carries discount fields', () => {
    const row = { TienCoThue: 6500000, TienChietKhau: 650000 };
    expect(resolveStoredRevenue(6500000, row, 5850000)).toBe(5850000);
  });

  describe('resolveStoredNetPayable', () => {
    it('recomputes from raw when discount fields exist', () => {
      const item = {
        tienCoThue: 1,
        rawData: {
          TienCoThue: 5855800,
          TienChietKhau: 546250,
          TongTienThanhToan: 5309550,
        },
      };
      expect(resolveStoredNetPayable(item)).toBe(5309550);
    });

    it('keeps the stored net when raw lacks discount fields (list row)', () => {
      const item = {
        tienCoThue: 5309550,
        rawData: { TienCoThue: 5855800, TienThanhToanKH: 0 },
      };
      expect(resolveStoredNetPayable(item)).toBe(5309550);
    });

    it('falls back to extractNetPayableAmount when nothing is stored', () => {
      const item = { tienCoThue: 0, rawData: { TienCoThue: 1000 } };
      expect(resolveStoredNetPayable(item)).toBe(1000);
    });

    it('returns 0 for missing input', () => {
      expect(resolveStoredNetPayable(null)).toBe(0);
    });
  });
});
