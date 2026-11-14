import { GarageItem } from '../entities/garage-item.entity';
import {
  toGarageItemEntityFields,
  toGarageItemResponse,
} from './garage-item.mapper';

describe('GarageItem mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  it('trả response DTO, không lộ isDeleted và nameNormalized', () => {
    const entity = {
      id: 'id-1',
      itemCode: 'PT-1',
      itemName: 'Lọc dầu',
      nameNormalized: 'loc dau',
      source: 'AI',
      isActive: true,
      isDeleted: false,
      createdAt,
      updatedAt: createdAt,
    } as GarageItem;

    expect(toGarageItemResponse(entity)).toEqual({
      id: 'id-1',
      extraData: {},
      itemCode: 'PT-1',
      itemName: 'Lọc dầu',
      unit: undefined,
      itemType: undefined,
      source: 'AI',
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('chuẩn hóa mã và tự tính tên không dấu', () => {
    expect(
      toGarageItemEntityFields({
        itemCode: ' vt-dau ',
        itemName: ' Dầu  nhớt ',
      }),
    ).toEqual({
      itemCode: 'VT-DAU',
      itemName: 'Dầu nhớt',
      nameNormalized: 'dau nhot',
    });
  });

  it('chỉ giữ các key được truyền', () => {
    expect(toGarageItemEntityFields({})).toEqual({});
  });
});
