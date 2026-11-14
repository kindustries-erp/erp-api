import type { BaseItemEntity } from '../entities/base-item.entity';
import { collectLookupKeys, resolveMatches } from './item-match.helper';

const kit = { types: ['AA', 'BB'] as const, defaultType: 'AA' as const };

const item = (itemCode: string, nameNormalized: string) =>
  ({ id: itemCode, itemCode, nameNormalized }) as BaseItemEntity;

describe('item-match.helper', () => {
  it('gom mã ứng viên và tên không dấu, bỏ trùng', () => {
    const keys = collectLookupKeys(
      [
        { itemCode: '90915', itemName: 'Lọc dầu' },
        { itemName: 'LỌC  DẦU' },
        { itemName: '***' },
      ],
      kit.types,
    );
    expect(keys.names).toEqual(['loc dau']);
    expect(keys.codes).toContain('90915');
    expect(keys.codes).toContain('AA-90915');
    expect(keys.codes).toContain('BB-90915');
  });

  it('ưu tiên khớp theo mã (kể cả mã đã lưu kèm tiền tố)', () => {
    const found = [item('AA-90915', 'loc dau toyota'), item('BB-1', 'loc dau')];
    const [match] = resolveMatches(
      [{ itemCode: '90915', itemName: 'Lọc dầu' }],
      found,
      kit,
    );
    expect(match).toMatchObject({
      status: 'MATCHED',
      matchedBy: 'CODE',
      itemType: 'AA',
    });
    expect(match.item?.itemCode).toBe('AA-90915');
  });

  it('khớp theo tên không dấu khi không có mã', () => {
    const [match] = resolveMatches(
      [{ itemName: 'Nhớt  CASTROL 5W30' }],
      [item('BB-000001', 'nhot castrol 5w30')],
      kit,
    );
    expect(match).toMatchObject({
      status: 'MATCHED',
      matchedBy: 'NAME',
      itemType: 'BB',
    });
  });

  it('dòng mới: đề xuất mã từ mã gốc + nhóm, nhóm lạ về mặc định, không có mã gốc thì để trống', () => {
    const [withCode, noCode, unknownType] = resolveMatches(
      [
        { itemCode: 'bat21001011', itemName: 'Pin', itemType: 'BB' },
        { itemName: 'Công sơn', itemType: 'bb' },
        { itemName: 'Khác', itemType: 'zz' },
      ],
      [],
      kit,
    );
    expect(withCode).toEqual({
      status: 'NEW',
      itemType: 'BB',
      suggestedCode: 'BB-BAT21001011',
    });
    expect(noCode).toEqual({
      status: 'NEW',
      itemType: 'BB',
      suggestedCode: undefined,
    });
    expect(unknownType.itemType).toBe('AA');
  });

  describe('whenNoCode (chứng từ nhập tay)', () => {
    const manual = { nameFallback: 'whenNoCode' as const };

    it('dòng có mã không khớp mã thì không khớp theo tên, và không gom tên vào khóa tra', () => {
      const lines = [{ itemCode: 'XYZ', itemName: 'Lọc dầu' }];
      expect(collectLookupKeys(lines, kit.types, manual).names).toEqual([]);
      const [match] = resolveMatches(
        lines,
        [item('AA-90915', 'loc dau')],
        kit,
        manual,
      );
      expect(match.status).toBe('NEW');
    });

    it('dòng không mã vẫn khớp theo tên', () => {
      const [match] = resolveMatches(
        [{ itemName: 'Lọc dầu' }],
        [item('AA-90915', 'loc dau')],
        kit,
        manual,
      );
      expect(match).toMatchObject({ status: 'MATCHED', matchedBy: 'NAME' });
    });

    it('prefixNewCodes=false giữ nguyên mã đã chuẩn hóa cho dòng mới', () => {
      const [match] = resolveMatches(
        [{ itemCode: 'ab 12', itemName: 'Pin' }],
        [],
        kit,
        { ...manual, prefixNewCodes: false },
      );
      expect(match.suggestedCode).toBe('AB12');
    });
  });
});
