import {
  codeCandidates,
  formatSequenceCode,
  itemTypeOfCode,
  normalizeItemCode,
  sequencePattern,
  toGarageItemType,
  withTypePrefix,
} from './garage-item-code.helper';

describe('garage-item-code.helper', () => {
  it('chuẩn hóa mã: chữ hoa, bỏ khoảng trắng và ký tự lạ', () => {
    expect(normalizeItemCode(' 90915 - yzzd2 ')).toBe('90915-YZZD2');
    expect(normalizeItemCode('pt#123*')).toBe('PT123');
    expect(normalizeItemCode(null)).toBe('');
  });

  it('nhận nhóm hàng hợp lệ, mặc định PT', () => {
    expect(toGarageItemType('vt')).toBe('VT');
    expect(toGarageItemType('xyz')).toBe('PT');
    expect(toGarageItemType(undefined)).toBe('PT');
  });

  it('suy nhóm từ tiền tố và gắn tiền tố khi thiếu', () => {
    expect(itemTypeOfCode('VF-BAT21001011')).toBe('VF');
    expect(itemTypeOfCode('90915-YZZD2')).toBeNull();
    expect(withTypePrefix('90915-yzzd2', 'PT')).toBe('PT-90915-YZZD2');
    expect(withTypePrefix('VT-DAU-NHOT', 'PT')).toBe('VT-DAU-NHOT');
    expect(withTypePrefix('  ', 'PT')).toBe('');
  });

  it('liệt kê mã ứng viên để tra danh mục', () => {
    expect(codeCandidates('VF-ABC')).toEqual(['VF-ABC']);
    const candidates = codeCandidates('abc');
    expect(candidates[0]).toBe('ABC');
    expect(candidates).toContain('PT-ABC');
    expect(candidates).toContain('CCDC-ABC');
    expect(codeCandidates('')).toEqual([]);
  });

  it('định dạng và mẫu regex của mã số thứ tự', () => {
    expect(formatSequenceCode('PT', 12)).toBe('PT-000012');
    expect(new RegExp(sequencePattern('PT')).test('PT-000012')).toBe(true);
    expect(new RegExp(sequencePattern('PT')).test('PT-90915')).toBe(false);
  });
});
