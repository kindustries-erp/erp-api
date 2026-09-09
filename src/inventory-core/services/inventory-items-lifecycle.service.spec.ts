import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryItemsLifecycleService } from './inventory-items-lifecycle.service';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from '../entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../entities/erp_inventory_balance.entity';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';

describe('InventoryItemsLifecycleService with Module Config', () => {
  let service: InventoryItemsLifecycleService;
  let mockItemRepo: any;
  let mockTxnRepo: any;
  let mockBalanceRepo: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockItemRepo = {
      create: jest
        .fn()
        .mockImplementation((dto) => ({ id: 'item-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((item) => Promise.resolve(item)),
      findOne: jest.fn().mockResolvedValue({
        id: 'item-uuid-1',
        sku: 'SKU-001',
        itemName: 'Test Item',
        attributes: ['CAN_BE_SOLD'],
      }),
      findOneBy: jest.fn().mockResolvedValue({
        id: 'item-uuid-1',
        sku: 'SKU-001',
        itemName: 'Test Item',
        attributes: ['CAN_BE_SOLD'],
      }),
    };

    mockBalanceRepo = {
      create: jest.fn().mockImplementation((b) => b),
      save: jest.fn().mockImplementation((b) => Promise.resolve(b)),
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockTxnRepo = {};

    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ cnt: '0' }]),
      transaction: jest.fn().mockImplementation(async (cb) => {
        const mockManager = {
          getRepository: (entity: any) => {
            if (entity === ErpInventoryItem) return mockItemRepo;
            if (entity === ErpInventoryBalance) return mockBalanceRepo;
            return {
              create: jest.fn().mockImplementation((x) => x),
              save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
              find: jest.fn().mockResolvedValue([]),
              findOne: jest.fn().mockResolvedValue(null),
              delete: jest.fn().mockResolvedValue({}),
            };
          },
          query: jest.fn().mockResolvedValue([]),
        };
        return cb(mockManager);
      }),
    };

    jest
      .spyOn(EntityCustomFieldsHelper, 'saveInTx')
      .mockResolvedValue(undefined as any);
    jest
      .spyOn(EntityCustomFieldsHelper, 'enrichOne')
      .mockImplementation(async (_ds, _type, entity: any) => {
        if (entity) {
          entity.customAttributes = { item_features: ['CAN_BE_SOLD'] };
          entity.attributes = entity.customAttributes;
          entity.attributeValues = [];
        }
        return entity;
      });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryItemsLifecycleService,
        {
          provide: getRepositoryToken(ErpInventoryItem),
          useValue: mockItemRepo,
        },
        {
          provide: getRepositoryToken(ErpInventoryTransaction),
          useValue: mockTxnRepo,
        },
        {
          provide: getRepositoryToken(ErpInventoryBalance),
          useValue: mockBalanceRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<InventoryItemsLifecycleService>(
      InventoryItemsLifecycleService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('create() should save customAttributes via EntityCustomFieldsHelper.saveInTx and enrich result', async () => {
    const res = await service.create({
      sku: 'SKU-001',
      itemName: 'Test Item',
      customAttributes: { item_features: ['CAN_BE_SOLD'], custom_color: 'Red' },
    });

    expect(res.message).toBe('Tạo thành công');
    expect(res.data.id).toBe('item-uuid-1');
    expect(EntityCustomFieldsHelper.saveInTx).toHaveBeenCalledWith(
      expect.anything(),
      'INVENTORY_ITEM',
      'item-uuid-1',
      expect.objectContaining({
        item_features: ['CAN_BE_SOLD'],
        custom_color: 'Red',
      }),
    );
    expect(EntityCustomFieldsHelper.enrichOne).toHaveBeenCalled();
  });

  it('findOne() should call EntityCustomFieldsHelper.enrichOne', async () => {
    const res = await service.findOne('item-uuid-1');
    expect(res.message).toBe('Lấy thông tin thành công');
    expect(res.data.hasSerials).toBe(false);
    expect(EntityCustomFieldsHelper.enrichOne).toHaveBeenCalledWith(
      mockDataSource,
      'INVENTORY_ITEM',
      expect.objectContaining({ id: 'item-uuid-1' }),
    );
  });

  it('update() should update customAttributes and call EntityCustomFieldsHelper.saveInTx', async () => {
    const res = await service.update('item-uuid-1', {
      itemName: 'Updated Item',
      customAttributes: {
        item_features: ['CAN_BE_SOLD', 'CAN_BE_MANUFACTURED'],
      },
    });

    expect(res.message).toBe('Cập nhật thành công');
    expect(EntityCustomFieldsHelper.saveInTx).toHaveBeenCalledWith(
      expect.anything(),
      'INVENTORY_ITEM',
      'item-uuid-1',
      expect.objectContaining({
        item_features: ['CAN_BE_SOLD', 'CAN_BE_MANUFACTURED'],
      }),
    );
  });
});
