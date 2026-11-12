import type { EntityManager, Repository } from 'typeorm';
import { BaseItemEntity } from '../entities/base-item.entity';
import { AbstractItemMatchService } from './abstract-item-match.service';

class TestItem extends BaseItemEntity {}
type TestType = 'AA' | 'BB';

class TestItemService extends AbstractItemMatchService<TestItem, TestType> {
  constructor(repo: Repository<TestItem>) {
    super(repo, {
      entity: TestItem,
      types: ['AA', 'BB'],
      defaultType: 'AA',
      lockKey: 'test_items:ensure',
    });
  }
}

function queryBuilder(found: TestItem[]) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(found),
  };
  return qb;
}

describe('AbstractItemMatchService', () => {
  const existing = {
    id: 'i1',
    itemCode: 'BB-000007',
    nameNormalized: 'nhot castrol',
  } as TestItem;

  it('match: một query cho cả lô, không query khi không có khóa tra', async () => {
    const qb = queryBuilder([existing]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new TestItemService(
      repo as unknown as Repository<TestItem>,
    );

    const result = await service.match([
      { itemName: 'Nhớt Castrol' },
      { itemName: 'Lọc gió', itemType: 'AA' },
    ]);

    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(result.map((m) => m.status)).toEqual(['MATCHED', 'NEW']);

    await service.match([{ itemName: '***' }]);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  describe('ensureItems', () => {
    let saved: TestItem[];
    let manager: {
      query: jest.Mock;
      getRepository: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
    let service: TestItemService;

    beforeEach(() => {
      saved = [];
      manager = {
        query: jest.fn((sql: string) =>
          Promise.resolve(sql.includes('MAX(') ? [{ max: 7 }] : []),
        ),
        getRepository: jest.fn(() => ({
          createQueryBuilder: () => queryBuilder([existing]),
          metadata: { tableName: 'test_items' },
        })),
        create: jest.fn((_entity: unknown, value: object) => value),
        save: jest.fn((_entity: unknown, value: TestItem) => {
          const row = { ...value, id: `new-${saved.length + 1}` };
          saved.push(row);
          return Promise.resolve(row);
        }),
      };
      service = new TestItemService({} as unknown as Repository<TestItem>);
    });

    it('khóa advisory trước, dùng mã có sẵn và tạo mã thiếu, tên bảng lấy từ metadata', async () => {
      const result = await service.ensureItems(
        [
          { itemName: 'Nhớt Castrol' },
          { itemName: 'Lọc gió', itemType: 'BB', unit: ' Cái ' },
          { itemCode: '90915', itemName: 'Lọc dầu', itemType: 'AA' },
          { itemName: 'Bugi', itemType: 'BB' },
        ],
        manager as unknown as EntityManager,
        { source: 'AI' },
      );

      expect(manager.query.mock.calls[0]).toEqual([
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        ['test_items:ensure'],
      ]);
      expect(result.items.map((i) => i.itemCode)).toEqual([
        'BB-000007',
        'BB-000008',
        'AA-90915',
        'BB-000009',
      ]);
      expect(result.created).toHaveLength(3);
      expect(saved[0]).toMatchObject({
        nameNormalized: 'loc gio',
        unit: 'Cái',
        source: 'AI',
        itemType: 'BB',
      });
      // Max của nhóm BB chỉ đọc một lần, trên bảng của entity
      const maxQueries = manager.query.mock.calls.filter(([sql]) =>
        String(sql).includes('MAX('),
      );
      expect(maxQueries).toHaveLength(1);
      expect(String(maxQueries[0][0])).toContain('"test_items"');
    });

    it('mặc định ghi nguồn MANUAL', async () => {
      await service.ensureItems(
        [{ itemName: 'Công sơn', itemType: 'AA' }],
        manager as unknown as EntityManager,
      );
      expect(saved[0].source).toBe('MANUAL');
    });

    it('nhánh nhanh: mọi dòng đã có thì không khóa, không ghi', async () => {
      const result = await service.ensureItems(
        [{ itemName: 'Nhớt Castrol' }],
        manager as unknown as EntityManager,
      );
      expect(result.items).toEqual([existing]);
      expect(result.created).toEqual([]);
      expect(manager.query).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('prefixNewCodes=false giữ nguyên mã gõ vào; dòng có mã không khớp theo tên', async () => {
      const result = await service.ensureItems(
        [{ itemCode: 'abc 1', itemName: 'Nhớt Castrol' }],
        manager as unknown as EntityManager,
        { nameFallback: 'whenNoCode', prefixNewCodes: false },
      );
      expect(result.items[0].itemCode).toBe('ABC1');
      expect(result.created).toHaveLength(1);
    });

    it('hai dòng cùng tên trong một lô chỉ tạo một mã', async () => {
      const result = await service.ensureItems(
        [
          { itemName: 'Công sơn', itemType: 'AA' },
          { itemName: 'CÔNG  SƠN', itemType: 'AA' },
        ],
        manager as unknown as EntityManager,
      );

      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(result.items[0]).toBe(result.items[1]);
    });
  });
});
