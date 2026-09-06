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

  it('extracts BOM attributes in explodePreview and getBomDetailsWithAttributes', async () => {
    const rootBom = {
      id: 'bom-1',
      bomCode: 'BOM-01',
      bomName: 'BOM Khung Xe',
      version: '1.0',
      status: 'ACTIVE',
      finishedGoodItemId: 'fg-1',
    };
    const bomRepo = {
      findOne: jest.fn().mockResolvedValue(rootBom),
      find: jest.fn().mockResolvedValue([]),
    };
    const bomLineRepo = {
      find: jest.fn().mockResolvedValue([
        {
          lineNo: 1,
          componentItemId: 'rm-1',
          qtyRequired: '1.000',
          scrapRate: null,
        },
      ]),
    };
    const itemRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'rm-1',
          sku: 'RM-1',
          itemName: 'Khung thép',
          uom: 'Cái',
          itemType: { code: 'RAW_MATERIAL' },
        },
      ]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const manager = makeManager({
      ErpBom: bomRepo,
      ErpBomLine: bomLineRepo,
      ErpInventoryItem: itemRepo,
    });

    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'bom-1',
          bom_code: 'BOM-01',
          bom_name: 'BOM Khung Xe',
          version: '1.0',
          status: 'ACTIVE',
          category_id: 'cat-1',
          category_code: 'FRAME',
          category_name: 'Khung xe',
        },
      ]) // bomRows
      .mockResolvedValueOnce([
        {
          id: 'def-1',
          code: 'steel_grade',
          name: 'Mác thép',
          name_en: 'Steel Grade',
          field_type: 'TEXT',
          options: null,
          is_required: true,
          sort_order: 1,
          is_global: false,
          value_text: 'SS400',
        },
      ]) // attrRows
      .mockResolvedValueOnce([
        {
          id: 'def-color',
          code: 'color',
          name: 'Màu sắc',
          name_en: 'Color',
          field_type: 'SELECT',
          options: [{ value: 'DO', label: 'Đỏ' }],
          is_required: false,
          sort_order: 0,
          is_global: true,
          value_text: 'DO',
        },
      ]); // globalRows

    const dataSource = {
      transaction: jest.fn(async (cb) => cb(manager)),
      getRepository: (entity: any) => manager.getRepository(entity),
      query: queryMock,
    } as any;

    const service = new ProductionCoreService(
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
      {} as any,
      {} as any,
    );

    const preview = await service.explodePreview('bom-1', 1);
    expect(preview.bom).toBeDefined();
    expect(preview.bom.bomCode).toBe('BOM-01');
    expect(preview.bom.categoryName).toBe('Khung xe');
    expect(preview.bom.attributeDetails).toHaveLength(2);
    expect(preview.bom.attributeDetails[0].code).toBe('color');
    expect(preview.bom.attributeDetails[0].label).toBe('Đỏ');
    expect(preview.bom.attributeDetails[1].code).toBe('steel_grade');
    expect(preview.bom.attributeDetails[1].value).toBe('SS400');
  });

  it('deduplicates duplicate attribute codes between global and category definitions', async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'bom-1',
          bom_code: 'BOM-01',
          bom_name: 'BOM Xe',
          version: '1.0',
          status: 'ACTIVE',
          category_id: 'cat-1',
          category_code: 'BIKE',
          category_name: 'Xe máy điện',
        },
      ]) // bomRows
      .mockResolvedValueOnce([
        {
          id: 'cat-def-color',
          code: 'color',
          name: 'Màu sắc',
          name_en: 'Color',
          field_type: 'SELECT',
          options: [{ value: 'DO', label: 'Đỏ' }],
          is_required: false,
          sort_order: 1,
          is_global: false,
          value_text: 'DO',
        },
        {
          id: 'cat-def-version',
          code: 'version',
          name: 'Phiên bản',
          name_en: 'Version',
          field_type: 'TEXT',
          options: null,
          is_required: false,
          sort_order: 2,
          is_global: false,
          value_text: '1.0',
        },
      ]) // attrRows (category has color & version)
      .mockResolvedValueOnce([
        {
          id: 'global-def-color',
          code: 'color',
          name: 'Màu sắc',
          name_en: 'Color',
          field_type: 'SELECT',
          options: [{ value: 'DO', label: 'Đỏ' }],
          is_required: false,
          sort_order: 0,
          is_global: true,
          value_text: null,
        },
        {
          id: 'global-def-version',
          code: 'version',
          name: 'Phiên bản',
          name_en: 'Version',
          field_type: 'TEXT',
          options: null,
          is_required: false,
          sort_order: 1,
          is_global: true,
          value_text: null,
        },
      ]); // globalRows (global has color & version)

    const dataSource = {
      query: queryMock,
    } as any;

    const service = new ProductionCoreService(
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
      {} as any,
      {} as any,
    );

    const details = await service.getBomDetailsWithAttributes('bom-1');
    expect(details.attributeDetails).toHaveLength(2);
    expect(details.attributeDetails.map((a) => a.code)).toEqual([
      'color',
      'version',
    ]);
    expect(details.attributeDetails[0].value).toBe('DO');
    expect(details.attributeDetails[1].value).toBe('1.0');
  });

  it('completes VEHICLE production with only vinNo and engineNo and inherits BOM attributes', async () => {
    const order = {
      id: 'po-1',
      referenceNo: 'MO-2026090001',
      status: 'IN_PROGRESS',
      qtyToProduce: '1.000',
      qtyProduced: '0.000',
      finishedGoodItemId: 'fg-1',
      warehouseCode: 'WH-01',
      outputMetadata: {
        bomId: 'bom-1',
        bomAttributes: { 'attr-1': 'Val1' },
        bomGlobalAttributes: { color: 'DO', version: '1.0' },
        bomAttributeDetails: [
          { code: 'color', value: 'DO' },
          { code: 'version', value: '1.0' },
          { code: 'motor_power', value: '800W' },
        ],
      },
    };

    const savedVehicles: any[] = [];
    const savedSerials: any[] = [];

    const manager = {
      getRepository: (entity: any) => {
        const name = entity?.name || entity;
        if (name === 'ErpProductionOrder') {
          return {
            findOne: jest.fn().mockResolvedValue(order),
            save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
          };
        }
        if (name === 'ErpProductionOrderMaterial') {
          return {
            find: jest.fn().mockResolvedValue([]),
          };
        }
        if (name === 'ErpInventoryBalance') {
          return {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((d) => d),
            save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
          };
        }
        if (name === 'ErpInventoryTransaction') {
          return {
            create: jest.fn().mockImplementation((d) => d),
            save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
          };
        }
        if (name === 'ErpGoodsReceipt') {
          return {
            createQueryBuilder: () => ({
              where: () => ({
                orderBy: () => ({
                  getOne: jest.fn().mockResolvedValue(null),
                }),
              }),
            }),
            create: jest.fn().mockImplementation((d) => ({ id: 'gr-1', ...d })),
            save: jest
              .fn()
              .mockImplementation((d) => Promise.resolve({ id: 'gr-1', ...d })),
          };
        }
        if (name === 'ErpGoodsReceiptLine') {
          return {
            create: jest
              .fn()
              .mockImplementation((d) => ({ id: 'grl-1', ...d })),
            save: jest
              .fn()
              .mockImplementation((d) =>
                Promise.resolve({ id: 'grl-1', ...d }),
              ),
          };
        }
        if (name === 'ErpInventoryItem') {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: 'fg-1',
              trackingPolicy: { code: 'VEHICLE' },
            }),
          };
        }
        if (name === 'ErpVehicle') {
          return {
            createQueryBuilder: () => ({
              select: () => ({
                where: () => ({
                  orWhere: () => ({
                    getRawMany: jest.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
            create: jest
              .fn()
              .mockImplementation((d) => ({ id: 'veh-1', ...d })),
            save: jest.fn().mockImplementation((d) => {
              const res = { id: 'veh-1', ...d };
              savedVehicles.push(res);
              return Promise.resolve(res);
            }),
          };
        }
        if (name === 'ErpInventoryTrackingSerial') {
          return {
            create: jest
              .fn()
              .mockImplementation((d) => ({ id: 'ser-1', ...d })),
            save: jest.fn().mockImplementation((d) => {
              const res = { id: 'ser-1', ...d };
              savedSerials.push(res);
              return Promise.resolve(res);
            }),
          };
        }
        if (name === 'ErpBomLine') {
          return {
            find: jest.fn().mockResolvedValue([]),
          };
        }
        if (name === 'ErpProductionOrderSerialAssignment') {
          return {
            save: jest.fn().mockResolvedValue({}),
          };
        }
        return {
          find: jest.fn().mockResolvedValue([]),
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
        };
      },
      query: jest.fn().mockResolvedValue([]),
    } as any;

    const dataSource = {
      transaction: jest.fn(async (cb) => cb(manager)),
      getRepository: (entity: any) => manager.getRepository(entity),
    } as any;

    const service = new ProductionCoreService(
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
      {} as any,
      {} as any,
    );

    // Call completeProduction with only vinNo and engineNo
    await service.completeProduction('po-1', {
      qtyFinished: 1,
      identifiers: [
        {
          vinNo: 'VIN-TEST-001',
          engineNo: 'ENG-TEST-001',
          // serialNo is not provided
          notes: 'Xe thử nghiệm',
        },
      ],
    });

    expect(savedVehicles).toHaveLength(1);
    expect(savedVehicles[0].vinNo).toBe('VIN-TEST-001');
    expect(savedVehicles[0].engineNo).toBe('ENG-TEST-001');

    expect(savedSerials).toHaveLength(1);
    expect(savedSerials[0].serialNo).toBe('ENG-TEST-001'); // fallback to engineNo
    expect(savedSerials[0].attributes).toMatchObject({
      color: 'DO',
      version: '1.0',
      motor_power: '800W',
    });
  });
});
