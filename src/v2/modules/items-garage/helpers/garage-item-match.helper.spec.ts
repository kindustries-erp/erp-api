import { GarageItem } from '../entities/garage-item.entity';
import { collectLookupKeys, resolveMatches } from './garage-item-match.helper';

const item = (itemCode: string, nameNormalized: string) =>
  ({ id: itemCode, itemCode, nameNormalized }) as GarageItem;

describe('garage-item-match.helper', () => {
  it('gom mã ứng viên và tên không dấu, bỏ trùng', () => {
    const keys = collectLookupKeys([
      { itemCode: '90915', itemName: 'Lọc dầu' },
      { itemName: 'LỌC  DẦU' },
      { itemName: '***' },
    ]);
    expect(keys.names).toEqual(['loc dau']);
    expect(keys.codes).toContain('90915');
    expect(keys.codes).toContain('PT-90915');
  });

  it('ưu tiên khớp theo mã (kể cả mã đã lưu kèm tiền tố)', () => {
    const found = [item('PT-90915', 'loc dau toyota'), item('VT-1', 'loc dau')];
    const [match] = resolveMatches(
      [{ itemCode: '90915', itemName: 'Lọc dầu' }],
      found,
    );
    expect(match).toMatchObject({
      status: 'MATCHED',
      matchedBy: 'CODE',
      itemType: 'PT',
    });
    expect(match.item?.itemCode).toBe('PT-90915');
  });

  it('khớp theo tên không dấu khi không có mã', () => {
    const [match] = resolveMatches(
      [{ itemName: 'Nhớt  CASTROL 5W30' }],
      [item('VT-000001', 'nhot castrol 5w30')],
    );
    expect(match).toMatchObject({
      status: 'MATCHED',
      matchedBy: 'NAME',
      itemType: 'VT',
    });
  });

  it('dòng mới: đề xuất mã từ mã gốc + nhóm, không có mã gốc thì để trống', () => {
    const [withCode, noCode] = resolveMatches(
      [
        { itemCode: 'bat21001011', itemName: 'Pin', itemType: 'VF' },
        { itemName: 'Công sơn', itemType: 'dv' },
      ],
      [],
    );
    expect(withCode).toEqual({
      status: 'NEW',
      itemType: 'VF',
      suggestedCode: 'VF-BAT21001011',
    });
    expect(noCode).toEqual({
      status: 'NEW',
      itemType: 'DV',
      suggestedCode: undefined,
    });
  });
});
