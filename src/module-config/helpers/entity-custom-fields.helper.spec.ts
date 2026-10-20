import { EntityCustomFieldsHelper } from './entity-custom-fields.helper';

describe('EntityCustomFieldsHelper', () => {
  describe('saveInTx', () => {
    it('should do nothing if customAttributes is empty or undefined', async () => {
      const manager: any = {
        getRepository: jest.fn(),
      };
      await EntityCustomFieldsHelper.saveInTx(
        manager,
        'GOODS_RECEIPT',
        'rec-1',
        {},
      );
      expect(manager.getRepository).not.toHaveBeenCalled();
    });

    it('should map by ID or Code and save values to erp_entity_attribute_values', async () => {
      const mockDefs = [
        {
          id: 'def-1',
          code: 'category',
          isGlobal: true,
          moduleKeyGlobal: 'GOODS_RECEIPT',
        },
        {
          id: 'def-2',
          code: 'custom_note',
          isGlobal: true,
          moduleKeyGlobal: 'GOODS_RECEIPT',
        },
      ];

      const defRepo = {
        find: jest.fn().mockResolvedValue(mockDefs),
      };
      const valueRepo = {
        delete: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue([]),
      };

      const manager: any = {
        getRepository: jest.fn((entity) => {
          if (entity.name === 'ErpModuleAttributeDef') return defRepo;
          if (entity.name === 'ErpEntityAttributeValue') return valueRepo;
          return {};
        }),
      };

      await EntityCustomFieldsHelper.saveInTx(
        manager,
        'GOODS_RECEIPT',
        'rec-1',
        {
          category: 'PO',
          'def-2': 'Ghi chú đặc biệt',
          ignored_field: 'Không có def',
        },
      );

      expect(valueRepo.delete).toHaveBeenCalledWith({
        entityType: 'GOODS_RECEIPT',
        entityId: 'rec-1',
      });

      expect(valueRepo.save).toHaveBeenCalledWith([
        {
          entityType: 'GOODS_RECEIPT',
          entityId: 'rec-1',
          attrDefId: 'def-1',
          valueText: 'PO',
        },
        {
          entityType: 'GOODS_RECEIPT',
          entityId: 'rec-1',
          attrDefId: 'def-2',
          valueText: 'Ghi chú đặc biệt',
        },
      ]);
    });
  });

  describe('enrichOne & enrichMany', () => {
    it('should enrich entities with customAttributes and attributeValues', async () => {
      const mockQueryRows = [
        {
          id: 'val-1',
          entityId: 'rec-1',
          attrDefId: 'def-1',
          valueText: 'PO',
          attrCode: 'category',
          attrName: 'Loại nhập kho',
          nameEn: 'Receipt Type',
          fieldType: 'SELECT',
          isSystem: true,
          sortOrder: 0,
        },
      ];

      const dataSource: any = {
        query: jest.fn().mockResolvedValue(mockQueryRows),
      };

      const entities = [{ id: 'rec-1', name: 'Phiếu 1' }, { id: 'rec-2' }];

      const enriched = await EntityCustomFieldsHelper.enrichMany(
        dataSource,
        'GOODS_RECEIPT',
        entities,
      );

      expect(enriched[0]).toHaveProperty('customAttributes');
      expect((enriched[0] as any).customAttributes).toEqual({
        'def-1': 'PO',
        category: 'PO',
        type_inventory_receipt: 'PO',
      });
      expect((enriched[0] as any).attributeValues).toHaveLength(1);
      expect((enriched[0] as any).attributeValues[0].attrCode).toBe('category');

      expect((enriched[1] as any).customAttributes).toEqual({});
      expect((enriched[1] as any).attributeValues).toEqual([]);
    });
  });
});

describe('EntityCustomFieldsHelper.enrichMany registry view', () => {
  it('GARAGE_CASE: thêm builtin + custom.byCode, loại def system/legacy khỏi custom', async () => {
    const ds: any = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'v1',
          entityId: 'c1',
          attrDefId: 'd1',
          valueText: 'abc',
          attrCode: 'ghi_chu',
          fieldType: 'TEXT',
          isSystem: false,
        },
        {
          id: 'v2',
          entityId: 'c1',
          attrDefId: 'd2',
          valueText: 'true',
          attrCode: 'exclude_from_debt',
          fieldType: 'CHECKBOX',
          isSystem: true,
        },
      ]),
    };
    const item: any = {
      id: 'c1',
      categoryId: 'cat',
      excludeFromReports: false,
      excludeFromDebt: true,
    };
    await EntityCustomFieldsHelper.enrichMany(ds, 'GARAGE_CASE', [item]);
    expect(item.builtin).toEqual({
      categoryId: 'cat',
      excludeFromReports: false,
      excludeFromDebt: true,
    });
    expect(item.custom).toEqual({ byCode: { ghi_chu: 'abc' } });
    expect(item.customAttributes.ghi_chu).toBe('abc');
  });

  it('module không có registry: không thêm builtin/custom', async () => {
    const ds: any = { query: jest.fn().mockResolvedValue([]) };
    const item: any = { id: 'x1' };
    await EntityCustomFieldsHelper.enrichMany(ds, 'BOM', [item]);
    expect(item.builtin).toBeUndefined();
    expect(item.custom).toBeUndefined();
  });
});
