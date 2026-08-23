import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ModuleConfigService } from './module-config.service';
import { ErpBomCategory } from '../bom-config/entities/erp_bom_category.entity';
import { ErpBomAttributeDef } from '../bom-config/entities/erp_bom_attribute_def.entity';
import { ErpBomAttributeValue } from '../bom-config/entities/erp_bom_attribute_value.entity';
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
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'def-1', ...entity })),
    update: jest.fn(),
  };

  const mockAttrValueRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockEntityAttrValueRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(entity)),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockManager = {
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
          provide: getRepositoryToken(ErpBomCategory),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(ErpBomAttributeDef),
          useValue: mockAttrDefRepo,
        },
        {
          provide: getRepositoryToken(ErpBomAttributeValue),
          useValue: mockAttrValueRepo,
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
      mockAttrValueRepo.count.mockResolvedValue(3);

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
      mockAttrValueRepo.count.mockResolvedValue(0);

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

    it('should throw BadRequestException if required attribute is missing', async () => {
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
      ).rejects.toThrow(BadRequestException);
    });
  });
});
