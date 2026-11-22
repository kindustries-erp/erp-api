import type { EntityManager, Repository } from 'typeorm';
import type { ResolvableLine } from '@/v2/core/items-core';
import { GarageItem } from '../entities/garage-item.entity';
import { GarageItemMatchService } from './garage-item-match.service';
import { GarageLineItemResolver } from './garage-line-item-resolver.service';

function queryBuilder(found: GarageItem[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(found),
  };
}

describe('GarageLineItemResolver', () => {
  const existing = {
    id: 'i1',
    itemCode: 'PT-90915',
    itemName: 'Lọc dầu',
    unit: 'Cái',
    nameNormalized: 'loc dau',
  } as GarageItem;

  function setup(found: GarageItem[]) {
    const saved: Array<Record<string, unknown>> = [];
    const manager = {
      query: jest.fn(() => Promise.resolve([{ max: 0 }])),
      getRepository: jest.fn(() => ({
        createQueryBuilder: () => queryBuilder(found),
        metadata: { tableName: 'items_garage' },
      })),
      create: jest.fn((_e: unknown, value: object) => value),
      save: jest.fn((_e: unknown, value: Record<string, unknown>) => {
        saved.push(value);
        return Promise.resolve({ id: `n${saved.length}`, ...value });
      }),
    };
    const match = new GarageItemMatchService(
      {} as unknown as Repository<GarageItem>,
    );
    return {
      resolver: new GarageLineItemResolver(match),
      manager: manager as unknown as EntityManager,
      raw: manager,
      saved,
    };
  }

  it('dòng có mã tiền tố/không tiền tố khớp danh mục thì dùng mã chuẩn, điền đơn vị còn trống', async () => {
    const { resolver, manager, raw } = setup([existing]);
    const [line] = await resolver.resolveLines(manager, [
      { itemCode: '90915', itemName: 'Tên khác', unit: '', qty: 2 },
    ]);
    expect(line).toMatchObject({
      itemCode: 'PT-90915',
      itemName: 'Tên khác',
      unit: 'Cái',
      qty: 2,
    });
    expect(raw.save).not.toHaveBeenCalled();
    expect(raw.query).not.toHaveBeenCalled(); // nhánh nhanh, không khóa
  });

  it('dòng có mã nhưng mã chưa có: tạo đúng mã đã gõ (không thay bằng mã trùng tên), nguồn MANUAL', async () => {
    const { resolver, manager, saved } = setup([existing]);
    const [line] = await resolver.resolveLines(manager, [
      { itemCode: 'abc 1', itemName: 'Lọc dầu' },
    ]);
    expect(line.itemCode).toBe('ABC1');
    expect(saved[0]).toMatchObject({
      itemCode: 'ABC1',
      source: 'MANUAL',
    });
  });

  it('dòng không mã: khớp theo tên; không khớp thì cấp mã theo nhóm mặc định PT', async () => {
    const { resolver, manager } = setup([existing]);
    const input: ResolvableLine[] = [
      { itemName: 'LỌC  DẦU' },
      { itemName: 'Bugi mới' },
    ];
    const lines = await resolver.resolveLines(manager, input);
    expect(lines[0].itemCode).toBe('PT-90915');
    expect(lines[1].itemCode).toBe('PT-000001');
  });

  it('create=false: chuẩn hóa mã đã có, không tạo mã mới', async () => {
    const { resolver, manager, raw } = setup([existing]);
    const lines = await resolver.resolveLines(
      manager,
      [
        { itemCode: '90915', itemName: 'x' },
        { itemCode: 'LẠ-1', itemName: 'y' },
      ],
      { create: false },
    );
    expect(lines[0].itemCode).toBe('PT-90915');
    expect(lines[1].itemCode).toBe('LẠ-1');
    expect(raw.save).not.toHaveBeenCalled();
  });
});
