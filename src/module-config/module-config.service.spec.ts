import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ModuleConfigService } from './module-config.service';
import { ErpModuleCategory } from './entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from './entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from './entities/erp_entity_attribute_value.entity';

describe('ModuleConfigService', () => {
  let service: ModuleConfigService;

  const mockCategoryRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'cat-1', ...entity })),
    update: jest.fn(),
  };

  const mockAttrDefRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'def-1', ...entity })),
    update: jest.fn(),
  };

  const mockEntityAttrValueRepo = {
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(entity)),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockManager = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    query: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((entity, dto) => dto),
    save: jest.fn((entity, list) => Promise.resolve(list)),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleConfigService,
        {
          provide: getRepositoryToken(ErpModuleCategory),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ErpModuleAttributeDef),
          useValue: mockAttrDefRepo,
        },
        {
          provide: getRepositoryToken(ErpEntityAttributeValue),
          useValue: mockEntityAttrValueRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ModuleConfigService>(ModuleConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategory', () => {
    it('should create category scoped by moduleKey', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);
      const result = await service.createCategory({
        moduleKey: 'INVOICE',
        code: 'EXPENSE',
        name: 'Hóa đơn Chi phí',
      });
      expect(result).toBeDefined();
      expect(mockCategoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleKey: 'INVOICE',
          code: 'EXPENSE',
        }),
      );
      expect(mockCategoryRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if code exists in the same moduleKey', async () => {
      mockCategoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        moduleKey: 'INVOICE',
        code: 'EXPENSE',
      });
      await expect(
        service.createCategory({
          moduleKey: 'INVOICE',
          code: 'EXPENSE',
          name: 'Hóa đơn Chi phí',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCategories', () => {
    it('should filter categories by moduleKey when provided', async () => {
      mockCategoryRepo.find.mockResolvedValue([
        {
          id: 'cat-1',
          moduleKey: 'BANK_TXN',
          code: 'INTERNAL',
          attributeDefs: [],
        },
      ]);
      const result = await service.getCategories('BANK_TXN');
      expect(mockCategoryRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false, moduleKey: 'BANK_TXN' },
        }),
      );
      expect(result.length).toBe(1);
    });
  });

  describe('createAttributeDef options validation', () => {
    it('should throw BadRequestException if SELECT options have duplicate keys', async () => {
      mockCategoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        code: 'EXPENSE',
      });
      mockAttrDefRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createAttributeDef({
          categoryId: 'cat-1',
          code: 'dept',
          name: 'Phòng ban',
          fieldType: 'SELECT',
          options: [
            { label: 'Kế toán', value: 'ACC' },
            { label: 'Kế toán tổng hợp', value: 'ACC' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAttributeDef', () => {
    it('should throw ConflictException if attribute is in use', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({ id: 'def-1', code: 'dept' });
      mockEntityAttrValueRepo.count.mockResolvedValue(3);

      await expect(service.deleteAttributeDef('def-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should soft delete if attribute is not in use', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'def-1',
        code: 'dept',
        isDeleted: false,
      });
      mockEntityAttrValueRepo.count.mockResolvedValue(0);

      await service.deleteAttributeDef('def-1');
      expect(mockAttrDefRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });
  });

  describe('getEntityValues and saveEntityValues', () => {
    it('should get entity values correctly', async () => {
      mockDataSource.query.mockResolvedValue([{ category_id: 'cat-1' }]);
      mockEntityAttrValueRepo.find.mockResolvedValue([
        {
          id: 'val-1',
          entityType: 'INVOICE',
          entityId: 'inv-123',
          categoryId: 'cat-1',
          attrDefId: 'def-1',
          valueText: 'IT',
          attrDef: { code: 'dept', name: 'Phòng ban', fieldType: 'TEXT' },
        },
      ]);
      mockCategoryRepo.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Hóa đơn Chi phí',
        attributeDefs: [],
      });

      const res = await service.getEntityValues('INVOICE', 'inv-123');
      expect(res.categoryId).toBe('cat-1');
      expect(res.attributes['def-1']).toBe('IT');
    });

    it('should validate and save entity values successfully', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'cat-1',
        attributeDefs: [
          {
            id: 'def-1',
            name: 'Phòng ban',
            isRequired: true,
            isActive: true,
            isDeleted: false,
          },
        ],
      });

      await service.saveEntityValues('INVOICE', 'inv-123', {
        categoryId: 'cat-1',
        attributes: { 'def-1': 'Phòng Kế toán' },
      });

      expect(mockManager.query).toHaveBeenCalled();
      expect(mockManager.delete).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should save category attributes smoothly without throwing if required attribute is missing', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'cat-1',
        attributeDefs: [
          {
            id: 'def-1',
            name: 'Phòng ban',
            isRequired: true,
            isActive: true,
            isDeleted: false,
          },
        ],
      });

      await expect(
        service.saveEntityValues('INVOICE', 'inv-123', {
          categoryId: 'cat-1',
          attributes: {},
        }),
      ).resolves.toBeUndefined();
    });

    it('should validate and save global attributes without category', async () => {
      mockManager.find = jest.fn().mockResolvedValue([
        {
          id: 'glob-1',
          name: 'Ghi chú chung',
          isRequired: true,
          isActive: true,
          isDeleted: false,
          isGlobal: true,
        },
      ]);

      await service.saveEntityValues('INVOICE', 'inv-123', {
        globalAttributes: { 'glob-1': 'Test note' },
      });

      expect(mockManager.delete).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should save entity values smoothly without throwing on missing required attributes', async () => {
      mockManager.find = jest.fn().mockResolvedValue([
        {
          id: 'glob-1',
          name: 'Ghi chú chung',
          isRequired: true,
          isActive: true,
          isDeleted: false,
          isGlobal: true,
        },
      ]);

      await expect(
        service.saveEntityValues('INVOICE', 'inv-123', {
          globalAttributes: {},
        }),
      ).resolves.toBeUndefined();
    });

    it('should update erp_invoices table when entityType is INVOICE_IN or INVOICE_OUT', async () => {
      mockManager.find = jest.fn().mockResolvedValue([]);
      mockManager.query = jest.fn().mockResolvedValue([]);

      await service.saveEntityValues('INVOICE_IN', 'inv-in-1', {
        categoryId: 'cat-in-1',
        attributes: {},
        globalAttributes: {},
      });

      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE erp_invoices SET category_id = $1'),
        ['cat-in-1', 'inv-in-1'],
      );

      await service.saveEntityValues('INVOICE_OUT', 'inv-out-1', {
        categoryId: 'cat-out-1',
        attributes: {},
        globalAttributes: {},
      });

      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE erp_invoices SET category_id = $1'),
        ['cat-out-1', 'inv-out-1'],
      );
    });

    it('should query erp_invoices table in getEntityValues when entityType is INVOICE_IN or INVOICE_OUT', async () => {
      mockDataSource.query = jest
        .fn()
        .mockResolvedValue([{ category_id: 'cat-in-1' }]);
      mockEntityAttrValueRepo.find = jest.fn().mockResolvedValue([]);
      mockCategoryRepo.findOne = jest
        .fn()
        .mockResolvedValue({ id: 'cat-in-1', attributeDefs: [] });
      mockAttrDefRepo.find = jest.fn().mockResolvedValue([]);

      const resIn = await service.getEntityValues('INVOICE_IN', 'inv-in-1');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT category_id FROM erp_invoices WHERE id = $1',
        ),
        ['inv-in-1'],
      );
      expect(resIn.categoryId).toBe('cat-in-1');

      const resOut = await service.getEntityValues('INVOICE_OUT', 'inv-out-1');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT category_id FROM erp_invoices WHERE id = $1',
        ),
        ['inv-out-1'],
      );
      expect(resOut.categoryId).toBe('cat-in-1');
    });

    it('should deduplicate attribute values when both UUID and code are present in globalAttributes to prevent unique constraint violations', async () => {
      mockManager.find = jest.fn().mockResolvedValue([
        {
          id: '181efcb3-aabb-4885-91c3-817d3e6b7a7b',
          code: 'type_invoice_out',
          name: 'Phân loại hóa đơn bán ra',
          isGlobal: true,
          moduleKeyGlobal: 'INVOICE_OUT',
          isDeleted: false,
        },
      ]);
      mockManager.save = jest
        .fn()
        .mockImplementation((entity, list) => Promise.resolve(list));

      await service.saveEntityValues(
        'INVOICE_OUT',
        '920b8499-b37a-4b82-8445-cca01ea82953',
        {
          categoryId: null,
          attributes: {},
          globalAttributes: {
            '181efcb3-aabb-4885-91c3-817d3e6b7a7b': 'SALE_SERVICE',
            type_invoice_out: 'SALE_SERVICE',
          },
        },
      );

      expect(mockManager.save).toHaveBeenCalledTimes(1);
      const savedEntities = (mockManager.save as jest.Mock).mock.calls[0][1];
      expect(savedEntities).toHaveLength(1);
      expect(savedEntities[0]).toMatchObject({
        entityType: 'INVOICE_OUT',
        entityId: '920b8499-b37a-4b82-8445-cca01ea82953',
        attrDefId: '181efcb3-aabb-4885-91c3-817d3e6b7a7b',
        valueText: 'SALE_SERVICE',
      });
    });

    it('should safely handle JSON serialization for objects/arrays and ignore empty/invalid non-UUID keys', async () => {
      mockManager.find = jest.fn().mockResolvedValue([
        {
          id: '11111111-1111-1111-1111-111111111111',
          code: 'tags',
          isGlobal: true,
          moduleKeyGlobal: 'INVOICE_OUT',
          isDeleted: false,
        },
      ]);
      mockManager.save = jest
        .fn()
        .mockImplementation((entity, list) => Promise.resolve(list));

      await service.saveEntityValues('INVOICE_OUT', 'inv-123', {
        categoryId: null,
        attributes: {},
        globalAttributes: {
          tags: ['A', 'B'],
          invalid_non_existent_key: 'value',
          '22222222-2222-2222-2222-222222222222': 'valid-uuid-direct',
          empty_key: '',
        },
      });

      expect(mockManager.save).toHaveBeenCalledTimes(1);
      const savedEntities = (mockManager.save as jest.Mock).mock.calls[0][1];
      expect(savedEntities).toHaveLength(2);
      expect(savedEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            attrDefId: '11111111-1111-1111-1111-111111111111',
            valueText: JSON.stringify(['A', 'B']),
          }),
          expect.objectContaining({
            attrDefId: '22222222-2222-2222-2222-222222222222',
            valueText: 'valid-uuid-direct',
          }),
        ]),
      );
    });
  });

  describe('Global attributes management', () => {
    it('should create a global attribute successfully', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue(null);
      const res = await service.createAttributeDef({
        isGlobal: true,
        moduleKeyGlobal: 'INVOICE',
        code: 'approval_note',
        name: 'Ghi chú phê duyệt',
        fieldType: 'TEXT',
      });
      expect(res).toBeDefined();
      expect(mockAttrDefRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isGlobal: true,
          moduleKeyGlobal: 'INVOICE',
          categoryId: null,
          code: 'approval_note',
        }),
      );
    });

    it('should get global attribute defs by moduleKey', async () => {
      mockAttrDefRepo.find.mockResolvedValue([
        {
          id: 'glob-1',
          code: 'note',
          name: 'Ghi chú',
          isGlobal: true,
          moduleKeyGlobal: 'INVOICE',
        },
      ]);
      const res = await service.getGlobalAttributeDefs('INVOICE');
      expect(res.length).toBe(1);
      expect(res[0].code).toBe('note');
    });
  });

  describe('Options Usage & Guard', () => {
    it('should return correct options usage map for an attribute', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'attr-select-1',
        name: 'Loại nhập kho',
        fieldType: 'SELECT',
        options: [
          { value: 'PO', label: 'Đơn mua hàng' },
          { value: 'RETURN', label: 'Nhập trả' },
          { value: 'OTHER', label: 'Nhập khác' },
        ],
      });

      mockEntityAttrValueRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { value: 'PO', count: '8' },
          { value: 'OTHER', count: '2' },
        ]),
      })) as any;

      const usage = await service.getAttributeOptionsUsage('attr-select-1');
      expect(usage).toEqual({
        PO: 8,
        RETURN: 0,
        OTHER: 2,
      });
    });

    it('should throw ConflictException when removing an option that is in use (for system attribute)', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'attr-select-1',
        name: 'Loại nhập kho',
        fieldType: 'SELECT',
        isSystem: true,
        options: [
          { value: 'PO', label: 'Đơn mua hàng' },
          { value: 'RETURN', label: 'Nhập trả' },
        ],
      });

      // Mock getAttributeOptionsUsage logic via repos
      mockEntityAttrValueRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'PO', count: '10' }]),
      })) as any;

      // Update options removing PO (which has 10 usages)
      await expect(
        service.updateAttributeDef('attr-select-1', {
          options: [{ value: 'RETURN', label: 'Nhập trả' }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when removing an option that is in use (for custom attribute)', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'attr-custom-1',
        name: 'Màu sắc tùy chỉnh',
        fieldType: 'SELECT',
        isSystem: false,
        options: [
          { value: 'RED', label: 'Đỏ' },
          { value: 'BLUE', label: 'Xanh' },
        ],
      });

      mockEntityAttrValueRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'RED', count: '3' }]),
      })) as any;

      // Removing RED which is in use
      await expect(
        service.updateAttributeDef('attr-custom-1', {
          options: [{ value: 'BLUE', label: 'Xanh' }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow removing an option when it has 0 usages', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'attr-select-1',
        name: 'Loại nhập kho',
        fieldType: 'SELECT',
        isSystem: true,
        options: [
          { value: 'PO', label: 'Đơn mua hàng' },
          { value: 'UNUSED', label: 'Chưa dùng' },
        ],
      });

      mockEntityAttrValueRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'PO', count: '5' }]),
      })) as any;

      // Removing UNUSED which has 0 usages
      const updated = await service.updateAttributeDef('attr-select-1', {
        options: [{ value: 'PO', label: 'Đơn mua hàng' }],
      });
      expect(updated).toBeDefined();
      expect(mockAttrDefRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when removing a core system option even with 0 usage', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'attr-select-1',
        name: 'Loại nhập kho',
        fieldType: 'SELECT',
        isSystem: true,
        options: [
          { value: 'PO', label: 'Đơn mua hàng' },
          { value: 'PRODUCTION', label: 'Nhập sản xuất' },
        ],
      });

      mockEntityAttrValueRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })) as any;

      // Cố tình xóa option PO (Core option)
      await expect(
        service.updateAttributeDef('attr-select-1', {
          options: [{ value: 'PRODUCTION', label: 'Nhập sản xuất' }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should query entity tables for GOODS_RECEIPT and count PO / PRODUCTION usages', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'attr-gr-type',
        code: 'type_inventory_receipt',
        name: 'Loại nhập kho',
        moduleKeyGlobal: 'GOODS_RECEIPT',
        isGlobal: true,
        isSystem: true,
        options: [
          { value: 'PO', label: 'Đơn mua hàng' },
          { value: 'PRODUCTION', label: 'Nhập sản xuất' },
          { value: 'OTHER', label: 'Nhập khác' },
        ],
      });

      mockEntityAttrValueRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })) as any;

      mockDataSource.query = jest
        .fn()
        .mockResolvedValueOnce([{ count: '12' }]) // PO count
        .mockResolvedValueOnce([{ count: '3' }]) // PRODUCTION count
        .mockResolvedValueOnce([{ count: '5' }]); // OTHER count

      const usage = await service.getAttributeOptionsUsage('attr-gr-type');
      expect(usage.PO).toBe(12);
      expect(usage.PRODUCTION).toBe(3);
      expect(usage.OTHER).toBe(5);
    });
  });
});
