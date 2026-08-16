import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BomConfigService } from './bom-config.service';
import { ErpBomCategory } from './entities/erp_bom_category.entity';
import { ErpBomAttributeDef } from './entities/erp_bom_attribute_def.entity';
import { ErpBomAttributeValue } from './entities/erp_bom_attribute_value.entity';

describe('BomConfigService', () => {
  let service: BomConfigService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomConfigService,
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
      ],
    }).compile();

    service = module.get<BomConfigService>(BomConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCategory', () => {
    it('should create category successfully', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);
      const result = await service.createCategory({
        code: 'CAR',
        name: 'Xe hơi',
      });
      expect(result).toBeDefined();
      expect(mockCategoryRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if code exists', async () => {
      mockCategoryRepo.findOne.mockResolvedValue({ id: 'cat-1', code: 'CAR' });
      await expect(
        service.createCategory({ code: 'CAR', name: 'Xe hơi' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createAttributeDef options validation', () => {
    it('should throw BadRequestException if SELECT options have duplicate keys', async () => {
      mockCategoryRepo.findOne.mockResolvedValue({ id: 'cat-1', code: 'CAR' });
      mockAttrDefRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createAttributeDef({
          categoryId: 'cat-1',
          code: 'color',
          name: 'Màu sắc',
          fieldType: 'SELECT',
          options: [
            { label: 'Đỏ', value: 'RED' },
            { label: 'Đỏ đậm', value: 'RED' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAttributeDef', () => {
    it('should throw ConflictException if attribute is in use by BOMs', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({ id: 'def-1', code: 'color' });
      mockAttrValueRepo.count.mockResolvedValue(2); // 2 BOMs using it

      await expect(service.deleteAttributeDef('def-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should soft delete if attribute is not in use', async () => {
      mockAttrDefRepo.findOne.mockResolvedValue({
        id: 'def-1',
        code: 'color',
        isDeleted: false,
      });
      mockAttrValueRepo.count.mockResolvedValue(0);

      await service.deleteAttributeDef('def-1');
      expect(mockAttrDefRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });
  });
});
