import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BomCoreService } from './bom-core.service';
import { ErpBom } from './entities/erp_bom.entity';
import { ErpBomLine } from './entities/erp_bom_line.entity';

describe('BomCoreService', () => {
  let service: BomCoreService;

  const mockBomRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'bom-uuid-1', ...entity })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockBomLineRepository = {
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) =>
      Promise.resolve({ id: 'line-uuid-1', ...entity }),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockManager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn((entity) => {
      if (entity === ErpBom) return mockBomRepository;
      if (entity === ErpBomLine) return mockBomLineRepository;
      return {
        create: jest.fn((dto) => dto),
        save: jest.fn((data) => Promise.resolve(data)),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        find: jest.fn().mockResolvedValue([]),
      };
    }),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomCoreService,
        {
          provide: getRepositoryToken(ErpBom),
          useValue: mockBomRepository,
        },
        {
          provide: getRepositoryToken(ErpBomLine),
          useValue: mockBomLineRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BomCoreService>(BomCoreService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should find one BOM by id with category relation and enriched attributes without relation error', async () => {
      const mockBom: any = {
        id: 'c8b2698b-4e60-496a-9be8-a21909354d0c',
        bomCode: 'BOM-001',
        bomName: 'BOM Test Xe Điện',
        finishedGoodItemId: 'fg-item-1',
        categoryId: 'cat-1',
        category: { id: 'cat-1', code: 'EV_MOTOR', name: 'Động cơ điện' },
        version: '1.0',
        status: 'ACTIVE',
        isDeleted: false,
      };

      const mockLines = [
        {
          id: 'line-1',
          bomId: mockBom.id,
          componentItemId: 'comp-1',
          qtyRequired: '2',
          uomId: 'uom-1',
          uom: { name: 'Cái' },
        },
      ];

      mockBomRepository.findOneOrFail.mockResolvedValue({ ...mockBom });
      mockBomLineRepository.find.mockResolvedValue(mockLines);

      // Mock queries for attributes, production count, finished good, and component items
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('erp_entity_attribute_values eav')) {
          return Promise.resolve([
            {
              id: 'eav-1',
              entityId: mockBom.id,
              attrDefId: 'def-color',
              valueText: 'RED',
              attrCode: 'color',
              attrName: 'Màu sắc',
              fieldType: 'SELECT',
              isSystem: true,
              sortOrder: 1,
              is_global: false,
            },
          ]);
        }
        if (sql.includes('erp_production_orders')) {
          return Promise.resolve([{ count: '0' }]);
        }
        if (sql.includes('public.erp_inventory_items WHERE id = $1::uuid')) {
          return Promise.resolve([
            { id: 'fg-item-1', sku: 'FG-001', item_name: 'Xe Máy Điện KL01' },
          ]);
        }
        if (sql.includes('WHERE i.id = ANY($1::uuid[])')) {
          return Promise.resolve([
            {
              id: 'comp-1',
              sku: 'COMP-001',
              item_name: 'Pin Lithium 72V',
              tracking_policy_code: 'SERIAL',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.findOne(mockBom.id);

      expect(mockBomRepository.findOneOrFail).toHaveBeenCalledWith({
        where: { id: mockBom.id, isDeleted: false },
        relations: { category: true },
      });
      expect(result.message).toBe('Lấy thông tin thành công');
      expect(result.data.id).toBe(mockBom.id);
      expect((result.data as any).categoryCode).toBe('EV_MOTOR');
      expect((result.data as any).categoryName).toBe('Động cơ điện');
      expect((result.data as any).hasProduction).toBe(false);
      expect((result.data as any).finishedGoodItemCode).toBe('FG-001');
      expect(result.data.lines).toHaveLength(1);
      expect((result.data.lines[0] as any).componentItemCode).toBe('COMP-001');
      expect((result.data.lines[0] as any).requiresSerialTracking).toBe(true);
    });

    it('should throw NotFoundException when BOM is not found in findOne', async () => {
      mockBomRepository.findOneOrFail.mockRejectedValue(
        new NotFoundException('Could not find any entity of type ErpBom'),
      );

      await expect(service.findOne('non-existent-id')).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated BOM list with finished good information', async () => {
      const mockItems: any[] = [
        {
          id: 'bom-1',
          bomCode: 'BOM-001',
          bomName: 'BOM Xe Máy',
          finishedGoodItemId: 'fg-1',
        },
      ];

      mockBomRepository.findAndCount.mockResolvedValue([mockItems, 1]);
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('erp_inventory_items WHERE id = ANY')) {
          return Promise.resolve([
            { id: 'fg-1', sku: 'XE-01', item_name: 'Klotus Alpha' },
          ]);
        }
        if (sql.includes('erp_entity_attribute_values')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect((result.items[0] as any).finishedGoodItemCode).toBe('XE-01');
      expect((result.items[0] as any).finishedGoodItemName).toBe(
        'XE-01 — Klotus Alpha',
      );
    });
  });

  describe('remove', () => {
    it('should prevent deletion if BOM has production orders', async () => {
      mockBomRepository.findOne.mockResolvedValue({
        id: 'bom-1',
        finishedGoodItemId: 'fg-1',
      });
      mockDataSource.query.mockResolvedValue([{ count: '2' }]);

      await expect(service.remove('bom-1')).rejects.toThrow(ConflictException);
    });

    it('should soft delete BOM if no production orders exist', async () => {
      mockBomRepository.findOne.mockResolvedValue({
        id: 'bom-1',
        finishedGoodItemId: 'fg-1',
      });
      mockDataSource.query.mockResolvedValue([{ count: '0' }]);

      const result = await service.remove('bom-1');

      expect(mockBomRepository.update).toHaveBeenCalledWith('bom-1', {
        isDeleted: true,
      });
      expect(result.message).toBe('Xóa thành công');
    });
  });
});
