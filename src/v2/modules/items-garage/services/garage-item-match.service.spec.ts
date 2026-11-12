import { EntityManager, Repository } from 'typeorm';
import { GarageItem } from '../entities/garage-item.entity';
import { GarageItemMatchService } from './garage-item-match.service';

function queryBuilder(found: GarageItem[]) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(found),
  };
  return qb;
}

describe('GarageItemMatchService', () => {
  const existing = {
    id: 'i1',
    itemCode: 'VT-000007',
    nameNormalized: 'nhot castrol',
  } as GarageItem;

  it('match: một query cho cả lô, không query khi không có khóa tra', async () => {
    const qb = queryBuilder([existing]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new GarageItemMatchService(
      repo as unknown as Repository<GarageItem>,
    );

    const result = await service.match([
      { itemName: 'Nhớt Castrol' },
      { itemName: 'Lọc gió', itemType: 'PT' },
    ]);

    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(result.map((m) => m.status)).toEqual(['MATCHED', 'NEW']);

    await service.match([{ itemName: '***' }]);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  describe('ensureItems', () => {
    let saved: GarageItem[];
    let manager: {
      query: jest.Mock;
      getRepository: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
    let service: GarageItemMatchService;

    beforeEach(() => {
      saved = [];
      manager = {
        query: jest.fn((sql: string) =>
          Promise.resolve(sql.includes('MAX(') ? [{ max: 7 }] : []),
        ),
        getRepository: jest.fn(() => ({
          createQueryBuilder: () => queryBuilder([existing]),
        })),
        create: jest.fn((_entity: unknown, value: object) => value),
        save: jest.fn((_entity: unknown, value: GarageItem) => {
          const row = { ...value, id: `new-${saved.length + 1}` };
          saved.push(row);
          return Promise.resolve(row);
        }),
      };
      service = new GarageItemMatchService(
        {} as unknown as Repository<GarageItem>,
      );
    });

    it('khóa advisory trước, dùng mã có sẵn và tạo mã thiếu', async () => {
      const result = await service.ensureItems(
        [
          { itemName: 'Nhớt Castrol' },
          { itemName: 'Lọc gió', itemType: 'VT', unit: ' Cái ' },
          { itemCode: '90915', itemName: 'Lọc dầu', itemType: 'PT' },
          { itemName: 'Bugi', itemType: 'VT' },
        ],
        manager as unknown as EntityManager,
      );

      expect(manager.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
      expect(result.items.map((i) => i.itemCode)).toEqual([
        'VT-000007',
        'VT-000008',
        'PT-90915',
        'VT-000009',
      ]);
      expect(result.created).toHaveLength(3);
      expect(saved[0]).toMatchObject({
        nameNormalized: 'loc gio',
        unit: 'Cái',
        source: 'AI',
        itemType: 'VT',
      });
      // Max của nhóm VT chỉ đọc một lần
      const maxQueries = manager.query.mock.calls.filter(([sql]) =>
        String(sql).includes('MAX('),
      );
      expect(maxQueries).toHaveLength(1);
    });

    it('hai dòng cùng tên trong một lô chỉ tạo một mã', async () => {
      const result = await service.ensureItems(
        [
          { itemName: 'Công sơn', itemType: 'DV' },
          { itemName: 'CÔNG  SƠN', itemType: 'DV' },
        ],
        manager as unknown as EntityManager,
      );

      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(result.items[0]).toBe(result.items[1]);
    });
  });
});
