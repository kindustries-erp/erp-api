import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { KgaraCaseConfigService } from './kgara-case-config.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { ErpModuleCategory } from '../../module-config/entities/erp_module_category.entity';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';

describe('KgaraCaseConfigService', () => {
  let service: KgaraCaseConfigService;
  let caseRepo: jest.Mocked<Repository<KgaraCase>>;
  let categoryRepo: jest.Mocked<Repository<ErpModuleCategory>>;
  let dataSource: jest.Mocked<DataSource>;
  let mockManager: any;

  const mockCase: Partial<KgaraCase> = {
    id: '11111111-1111-1111-1111-111111111111',
    soChungTu: 'PDV-202609-001',
    hdPhieuDichVuId: 'GW-001',
    classification: 'SUA_CHUA_CHUNG',
    categoryId: 'cat-uuid-1',
    excludeFromReports: false,
    excludeFromDebt: false,
    erpNotes: 'Ghi chú ban đầu',
  };

  const mockCategory: Partial<ErpModuleCategory> = {
    id: 'cat-uuid-2',
    code: 'KY_GUI_NOI_BO',
    name: 'Ký gửi / Nội bộ',
    moduleKey: 'GARAGE_CASE',
  };

  beforeEach(async () => {
    mockManager = {
      save: jest
        .fn()
        .mockImplementation((entityClass, data) => Promise.resolve(data)),
    };

    const mockCaseRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const mockCategoryRepo = {
      findOne: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      query: jest.fn().mockResolvedValue([]),
    };

    jest
      .spyOn(EntityCustomFieldsHelper, 'saveInTx')
      .mockResolvedValue(undefined as any);
    jest
      .spyOn(EntityCustomFieldsHelper, 'enrichOne')
      .mockImplementation(async (_ds, _type, entity) => {
        (entity as any).customAttributes =
          (entity as any).customAttributes || {};
        (entity as any).attributes = (entity as any).attributes || {};
        (entity as any).attributeValues = (entity as any).attributeValues || [];
        return entity;
      });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCaseConfigService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: getRepositoryToken(ErpModuleCategory),
          useValue: mockCategoryRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<KgaraCaseConfigService>(KgaraCaseConfigService);
    caseRepo = module.get(getRepositoryToken(KgaraCase));
    categoryRepo = module.get(getRepositoryToken(ErpModuleCategory));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findCaseByAnyId', () => {
    it('should query by UUID when ID format matches UUID', async () => {
      caseRepo.findOne.mockResolvedValue({ ...mockCase } as KgaraCase);

      const result = await service.findCaseByAnyId(
        '11111111-1111-1111-1111-111111111111',
      );
      expect(result).toBeDefined();
      expect(caseRepo.findOne).toHaveBeenCalledWith({
        where: [
          { id: '11111111-1111-1111-1111-111111111111' },
          { soChungTu: '11111111-1111-1111-1111-111111111111' },
          { hdPhieuDichVuId: '11111111-1111-1111-1111-111111111111' },
        ],
        relations: ['category'],
      });
    });

    it('should query by soChungTu and hdPhieuDichVuId when ID is a document code', async () => {
      caseRepo.findOne.mockResolvedValue({ ...mockCase } as KgaraCase);

      const result = await service.findCaseByAnyId('PDV-202609-001');
      expect(result).toBeDefined();
      expect(caseRepo.findOne).toHaveBeenCalledWith({
        where: [
          { soChungTu: 'PDV-202609-001' },
          { hdPhieuDichVuId: 'PDV-202609-001' },
        ],
        relations: ['category'],
      });
    });
  });

  describe('updateCaseConfig', () => {
    it('should throw NotFoundException if case is not found', async () => {
      caseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCaseConfig('non-existent-id', { erpNotes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update categoryId and resolve classification correctly', async () => {
      const existingCase = { ...mockCase } as KgaraCase;
      caseRepo.findOne.mockResolvedValue(existingCase);
      categoryRepo.findOne.mockResolvedValue({
        ...mockCategory,
      } as ErpModuleCategory);

      const result = await service.updateCaseConfig(existingCase.id, {
        categoryId: 'cat-uuid-2',
        excludeFromReports: true,
        excludeFromDebt: true,
        erpNotes: 'Updated notes',
      });

      expect(result.categoryId).toBe('cat-uuid-2');
      expect(result.classification).toBe('KY_GUI_NOI_BO');
      expect(result.excludeFromReports).toBe(true);
      expect(result.excludeFromDebt).toBe(true);
      expect(result.erpNotes).toBe('Updated notes');
      expect(mockManager.save).toHaveBeenCalled();
      expect(EntityCustomFieldsHelper.saveInTx).toHaveBeenCalledWith(
        mockManager,
        'GARAGE_CASE',
        existingCase.id,
        expect.objectContaining({
          exclude_from_reports: true,
          exclude_from_debt: true,
        }),
      );
      expect(EntityCustomFieldsHelper.enrichOne).toHaveBeenCalled();
    });

    it('should update classification and resolve categoryId if categoryId is omitted', async () => {
      const existingCase = { ...mockCase } as KgaraCase;
      caseRepo.findOne.mockResolvedValue(existingCase);
      categoryRepo.findOne.mockResolvedValue({
        ...mockCategory,
      } as ErpModuleCategory);

      const result = await service.updateCaseConfig(existingCase.id, {
        classification: 'KY_GUI_NOI_BO',
      });

      expect(result.classification).toBe('KY_GUI_NOI_BO');
      expect(result.categoryId).toBe('cat-uuid-2');
    });

    it('should accept and merge attributes and globalAttributes into customAttributes', async () => {
      const existingCase = { ...mockCase } as KgaraCase;
      caseRepo.findOne.mockResolvedValue(existingCase);

      await service.updateCaseConfig(existingCase.id, {
        attributes: { attr_field_1: 'val1' },
        globalAttributes: { global_field_1: 'val2' },
        customAttributes: { custom_field_1: 'val3' },
      });

      expect(EntityCustomFieldsHelper.saveInTx).toHaveBeenCalledWith(
        mockManager,
        'GARAGE_CASE',
        existingCase.id,
        expect.objectContaining({
          attr_field_1: 'val1',
          global_field_1: 'val2',
          custom_field_1: 'val3',
        }),
      );
    });
  });
});
