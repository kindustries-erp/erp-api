import { DataSource, EntityManager, In } from 'typeorm';
import { ErpModuleAttributeDef } from '../entities/erp_module_attribute_def.entity';
import { ErpEntityAttributeValue } from '../entities/erp_entity_attribute_value.entity';

export interface AttributeValueDetail {
  id: string;
  attrDefId: string;
  attrCode?: string;
  attrName?: string;
  nameEn?: string | null;
  fieldType: string;
  valueText: string | null;
  isSystem: boolean;
}

export class EntityCustomFieldsHelper {
  /**
   * Lưu các giá trị thuộc tính mặc định & tùy chỉnh trong Database Transaction của module
   *
   * @param manager           TypeORM EntityManager trong transaction
   * @param entityType        Phân hệ (VD: 'GOODS_RECEIPT', 'GOODS_ISSUE', 'INVENTORY_ADJUSTMENT', 'INVOICE_IN', 'INVOICE_OUT', 'BOM')
   * @param entityId          ID của bản ghi thực thể (UUID)
   * @param customAttributes  Record key-value (key có thể là attr_def_id hoặc attr code)
   */
  static async saveInTx(
    manager: EntityManager,
    entityType: string,
    entityId: string,
    customAttributes?: Record<string, any> | null,
  ): Promise<void> {
    if (!customAttributes || Object.keys(customAttributes).length === 0) {
      return;
    }

    const upperType = entityType.trim().toUpperCase();

    // 1. Lấy danh sách Attribute Defs của phân hệ này
    const defRepo = manager.getRepository(ErpModuleAttributeDef);
    const defs = await defRepo.find({
      where: {
        isGlobal: true,
        moduleKeyGlobal: upperType,
        isDeleted: false,
      },
    });

    if (defs.length === 0) {
      return;
    }

    // Map tra cứu def theo cả ID và code
    const defMapById = new Map<string, ErpModuleAttributeDef>();
    const defMapByCode = new Map<string, ErpModuleAttributeDef>();

    for (const d of defs) {
      defMapById.set(d.id, d);
      if (d.code) {
        defMapByCode.set(d.code.trim().toLowerCase(), d);
      }
    }

    // 2. Chuẩn bị danh sách giá trị cần lưu
    const valuesToInsert: Array<{
      entityType: string;
      entityId: string;
      attrDefId: string;
      valueText: string;
    }> = [];

    const processedDefIds = new Set<string>();

    for (const [key, rawValue] of Object.entries(customAttributes)) {
      if (rawValue === undefined || rawValue === null) continue;
      const strVal = String(rawValue).trim();
      if (strVal === '') continue;

      let matchedDef = defMapById.get(key);
      if (!matchedDef) {
        matchedDef = defMapByCode.get(key.trim().toLowerCase());
      }

      if (matchedDef && !processedDefIds.has(matchedDef.id)) {
        processedDefIds.add(matchedDef.id);
        valuesToInsert.push({
          entityType: upperType,
          entityId,
          attrDefId: matchedDef.id,
          valueText: strVal,
        });
      }
    }

    // 3. Xóa các giá trị cũ của entity trong phân hệ này và insert các giá trị mới
    const valueRepo = manager.getRepository(ErpEntityAttributeValue);
    await valueRepo.delete({
      entityType: upperType,
      entityId,
    });

    if (valuesToInsert.length > 0) {
      await valueRepo.save(valuesToInsert as any);
    }
  }

  /**
   * Tự động nhúng customAttributes & attributeValues vào 1 bản ghi thực thể (dành cho findOne)
   *
   * @param dataSource  DataSource hoặc EntityManager
   * @param entityType  Phân hệ (VD: 'GOODS_RECEIPT', 'GOODS_ISSUE', ...)
   * @param entity      Bản ghi thực thể
   */
  static async enrichOne<T extends { id: string }>(
    dataSource: DataSource | EntityManager,
    entityType: string,
    entity: T,
  ): Promise<T> {
    if (!entity || !entity.id) {
      return entity;
    }

    const [enriched] = await this.enrichMany(dataSource, entityType, [entity]);
    return enriched || entity;
  }

  /**
   * Tự động nhúng customAttributes & attributeValues cho danh sách thực thể (dành cho findAll - Batch Load 1 Query)
   *
   * @param dataSource  DataSource hoặc EntityManager
   * @param entityType  Phân hệ (VD: 'GOODS_RECEIPT', 'GOODS_ISSUE', ...)
   * @param entities    Danh sách thực thể
   */
  static async enrichMany<T extends { id: string }>(
    dataSource: DataSource | EntityManager,
    entityType: string,
    entities: T[],
  ): Promise<T[]> {
    if (!entities || entities.length === 0) {
      return entities;
    }

    const upperType = entityType.trim().toUpperCase();
    const entityIds = entities.map((e) => e.id).filter(Boolean);

    if (entityIds.length === 0) {
      return entities;
    }

    try {
      const rows = await dataSource.query(
        `
        SELECT 
          eav.id,
          eav.entity_id as "entityId",
          eav.attr_def_id as "attrDefId",
          eav.value_text as "valueText",
          def.code as "attrCode",
          def.name as "attrName",
          def.name_en as "nameEn",
          def.field_type as "fieldType",
          def.is_system as "isSystem",
          def.sort_order as "sortOrder"
        FROM erp_entity_attribute_values eav
        JOIN erp_module_attribute_defs def ON def.id = eav.attr_def_id
        WHERE eav.entity_type = $1
          AND eav.entity_id = ANY($2)
          AND def.is_deleted = false
        ORDER BY def.sort_order ASC, def.created_at ASC
      `,
        [upperType, entityIds],
      );

      const map: Record<
        string,
        {
          customAttributes: Record<string, any>;
          attributeValues: AttributeValueDetail[];
        }
      > = {};

      for (const row of rows) {
        if (!map[row.entityId]) {
          map[row.entityId] = {
            customAttributes: {},
            attributeValues: [],
          };
        }
        const entry = map[row.entityId];

        // Map cả Def ID và Def Code vào customAttributes
        entry.customAttributes[row.attrDefId] = row.valueText;
        if (row.attrCode) {
          entry.customAttributes[row.attrCode] = row.valueText;
        }

        entry.attributeValues.push({
          id: row.id,
          attrDefId: row.attrDefId,
          attrCode: row.attrCode,
          attrName: row.attrName,
          nameEn: row.nameEn,
          fieldType: row.fieldType,
          valueText: row.valueText,
          isSystem: Boolean(row.isSystem),
        });
      }

      for (const item of entities) {
        const found = map[item.id];
        if (found) {
          (item as any).customAttributes = found.customAttributes;
          (item as any).attributes = found.customAttributes; // Tương thích ngược
          (item as any).attributeValues = found.attributeValues;
        } else {
          (item as any).customAttributes = {};
          (item as any).attributes = {};
          (item as any).attributeValues = [];
        }
      }
    } catch (err) {
      // Fallback an toàn nếu xảy ra lỗi truy vấn
      for (const item of entities) {
        if (!(item as any).customAttributes) {
          (item as any).customAttributes = {};
          (item as any).attributes = {};
          (item as any).attributeValues = [];
        }
      }
    }

    return entities;
  }
}
