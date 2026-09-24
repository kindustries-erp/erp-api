import {
  parseSafeDate,
  extractNetPayableAmount,
  extractKgaraClassification,
  mapKgaraClassificationToErp,
} from './kgara-parser.util';

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
    it('should map NBPQ to OJ', () => {
      expect(mapKgaraClassificationToErp('NBPQ', 'Nội Bộ PQ')).toBe('OJ');
      expect(mapKgaraClassificationToErp('nbpq', 'Nội Bộ PQ')).toBe('OJ');
      expect(mapKgaraClassificationToErp('', 'Nội Bộ PQ')).toBe('OJ');
      expect(mapKgaraClassificationToErp('', 'NOI BO PQ')).toBe('OJ');
    });

    it('should map Sales tặng to KHAC', () => {
      expect(mapKgaraClassificationToErp('Sales tặng', 'Sales tặng')).toBe(
        'KHAC',
      );
      expect(mapKgaraClassificationToErp('SALES', 'Tặng khách')).toBe('KHAC');
      expect(mapKgaraClassificationToErp('', 'Sales tặng')).toBe('KHAC');
      expect(mapKgaraClassificationToErp('', 'SALES TANG')).toBe('KHAC');
    });

    it('should map other KGara classifications to KY_GUI_NOI_BO', () => {
      expect(mapKgaraClassificationToErp('Ký gửi NSG', 'Ký gửi NSG')).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('KY GUI', 'Xe ký gửi')).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('Ký gửi PQ', 'Ký gửi PQ')).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('KG-NB', 'Ký gửi / Nội bộ')).toBe(
        'KY_GUI_NOI_BO',
      );
      expect(mapKgaraClassificationToErp('UNKNOWN_CODE', 'Khách lạ')).toBe(
        'KY_GUI_NOI_BO',
      );
    });

    it('should return null when both code and name are empty', () => {
      expect(mapKgaraClassificationToErp(null, null)).toBeNull();
      expect(mapKgaraClassificationToErp('', '')).toBeNull();
      expect(mapKgaraClassificationToErp('   ', '   ')).toBeNull();
    });
  });
});
