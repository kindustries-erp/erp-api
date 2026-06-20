import { BadRequestException } from '@nestjs/common';
import { ProductionCoreService } from './production-core.service';

describe('ProductionCoreService', () => {
  const makeManager = (overrides: Record<string, any> = {}) => {
    const repos = new Map<string, any>();
    const getRepository = (entity: any) => {
      const name = entity.name;
      if (!repos.has(name)) {
        repos.set(name, overrides[name] ?? {});
      }
      return repos.get(name);
    };
    return { getRepository };
  };

  const makeService = (manager: any) => {
    const dataSource = {
      transaction: jest.fn(async (cb) => cb(manager)),
    } as any;
    return new ProductionCoreService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  };

  it('fails when BOM references itself through child BOM cycle', async () => {
    const rootBom = {
      id: 'bom-fg',
      finishedGoodItemId: 'fg',
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    const childBom = {
      id: 'bom-sub',
      finishedGoodItemId: 'sub',
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    const bomRepo = {
      findOne: jest.fn().mockResolvedValueOnce(rootBom),
      find: jest
        .fn()
        .mockResolvedValueOnce([childBom])
        .mockResolvedValueOnce([rootBom]),
    };
    const bomLineRepo = {
      find: jest
        .fn()
        .mockResolvedValueOnce([
          {
            lineNo: 1,
            componentItemId: 'sub',
            qtyRequired: '1.000',
            scrapRate: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            lineNo: 1,
            componentItemId: 'fg',
            qtyRequired: '1.000',
            scrapRate: null,
          },
        ]),
    };

    const service = makeService(
      makeManager({
        ErpBom: bomRepo,
        ErpBomLine: bomLineRepo,
        ErpInventoryBalance: { findOne: jest.fn() },
        ErpInventoryTransaction: { save: jest.fn() },
        ErpProductionOrder: { save: jest.fn() },
        ErpProductionOrderMaterial: { save: jest.fn() },
        ErpInventoryItem: {
          find: jest.fn().mockResolvedValue([]),
          findOne: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(
      service.execute({
        finishedGoodItemId: 'fg',
        qtyToProduce: '1.000',
        warehouseCode: 'WH-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('fails when a material balance is missing', async () => {
    const rootBom = {
      id: 'bom-fg',
      finishedGoodItemId: 'fg',
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    const bomRepo = {
      findOne: jest.fn().mockResolvedValueOnce(rootBom),
      find: jest.fn().mockResolvedValueOnce([]),
    };
    const bomLineRepo = {
      find: jest.fn().mockResolvedValueOnce([
        {
          lineNo: 1,
          componentItemId: 'rm-a',
          qtyRequired: '2.000',
          scrapRate: null,
        },
      ]),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    const productionRepo = {
      save: jest.fn().mockResolvedValue({ id: 'prod-1' }),
    };
    const materialRepo = { save: jest.fn() };
    const txnRepo = { save: jest.fn() };

    const service = makeService(
      makeManager({
        ErpBom: bomRepo,
        ErpBomLine: bomLineRepo,
        ErpInventoryBalance: balanceRepo,
        ErpInventoryTransaction: txnRepo,
        ErpProductionOrder: productionRepo,
        ErpProductionOrderMaterial: materialRepo,
        ErpInventoryItem: {
          find: jest
            .fn()
            .mockResolvedValue([
              { id: 'rm-a', sku: 'RM-A', itemName: 'Thép tấm A' },
            ]),
          findOne: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(
      service.execute({
        finishedGoodItemId: 'fg',
        qtyToProduce: '3.000',
        warehouseCode: 'WH-1',
      }),
    ).rejects.toThrow('Không tìm thấy tồn kho cho NVL RM-A — Thép tấm A');
  });
});
