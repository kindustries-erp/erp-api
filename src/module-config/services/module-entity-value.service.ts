import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { ErpEntityAttributeValue } from '../entities/erp_entity_attribute_value.entity';
import { ErpModuleCategory } from '../entities/erp_module_category.entity';
import { ErpModuleAttributeDef } from '../entities/erp_module_attribute_def.entity';
import { SaveEntityValuesDto } from '../dto/save-entity-values.dto';

@Injectable()
export class ModuleEntityValueService {
  constructor(
    @InjectRepository(ErpEntityAttributeValue)
    private readonly entityAttrValueRepo: Repository<ErpEntityAttributeValue>,
    @InjectRepository(ErpModuleCategory)
    private readonly categoryRepo: Repository<ErpModuleCategory>,
    @InjectRepository(ErpModuleAttributeDef)
    private readonly attrDefRepo: Repository<ErpModuleAttributeDef>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lấy cấu hình custom fields (category + attributes + globalAttributes + values) của một entity bất kỳ
   */
  async getEntityValues(entityType: string, entityId: string) {
    const rawUpperType = (entityType || '').trim().toUpperCase();
    const upperType =
      rawUpperType === 'RECEIPT'
        ? 'GOODS_RECEIPT'
        : rawUpperType === 'ISSUE'
          ? 'GOODS_ISSUE'
          : rawUpperType === 'ADJUSTMENT'
            ? 'INVENTORY_ADJUSTMENT'
            : rawUpperType;

    // 1. Lấy categoryId từ entity table nếu có
    let categoryId: string | null = null;
    let invoiceIsValid: boolean | null = null;
    if (
      upperType === 'INVOICE' ||
      upperType === 'INVOICE_IN' ||
      upperType === 'INVOICE_OUT'
    ) {
      const rows = await this.dataSource.query(
        `SELECT category_id, is_valid FROM erp_invoices WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
      if (
        rows[0] &&
        rows[0].is_valid !== undefined &&
        rows[0].is_valid !== null
      ) {
        invoiceIsValid = Boolean(rows[0].is_valid);
      }
    } else if (upperType === 'BANK_TXN') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_bank_transactions WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'BOM') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_boms WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'GOODS_RECEIPT') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_goods_receipts WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'GOODS_ISSUE') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_goods_issues WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    } else if (upperType === 'INVENTORY_ADJUSTMENT') {
      const rows = await this.dataSource.query(
        `SELECT category_id FROM erp_inventory_adjustments WHERE id = $1`,
        [entityId],
      );
      categoryId = rows[0]?.category_id || null;
    }

    // 2. Lấy giá trị thuộc tính từ erp_entity_attribute_values
    const entityTypesToQuery = [upperType];
    if (rawUpperType !== upperType) {
      entityTypesToQuery.push(rawUpperType);
    }
    if (upperType === 'INVOICE_IN' || upperType === 'INVOICE_OUT') {
      if (!entityTypesToQuery.includes('INVOICE')) {
        entityTypesToQuery.push('INVOICE');
      }
    }

    const entityValues = await this.entityAttrValueRepo.find({
      where: { entityType: In(entityTypesToQuery), entityId },
      relations: { attrDef: true },
    });

    // Nếu chưa có categoryId từ entity table, lấy từ entity_attribute_values nếu có
    if (!categoryId && entityValues.length > 0) {
      const catVal = entityValues.find((ev) => ev.categoryId);
      if (catVal?.categoryId) {
        categoryId = catVal.categoryId;
      }
    }

    // 3. Category và Category Attribute Defs
    let category: ErpModuleCategory | null = null;
    if (categoryId) {
      category = await this.categoryRepo.findOne({
        where: { id: categoryId, isDeleted: false },
        relations: { attributeDefs: true },
      });
      if (category && category.attributeDefs) {
        category.attributeDefs = category.attributeDefs
          .filter((d) => !d.isDeleted && !d.isGlobal)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
    }

    // 4. Global Attribute Defs for this module
    const globalAttributeDefs = await this.attrDefRepo.find({
      where: [
        { isGlobal: true, moduleKeyGlobal: upperType, isDeleted: false },
        ...(rawUpperType !== upperType
          ? [
              {
                isGlobal: true,
                moduleKeyGlobal: rawUpperType,
                isDeleted: false,
              },
            ]
          : []),
      ],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    // 5. Tách giá trị thành category attributes và global attributes
    const attributes: Record<string, any> = {};
    const globalAttributes: Record<string, any> = {};
    const globalDefIds = new Set(globalAttributeDefs.map((g) => g.id));

    for (const ev of entityValues) {
      if (globalDefIds.has(ev.attrDefId) || ev.attrDef?.isGlobal) {
        globalAttributes[ev.attrDefId] = ev.valueText;
        if (ev.attrDef?.code) {
          globalAttributes[ev.attrDef.code] = ev.valueText;
          if (ev.attrDef.code === 'category') {
            if (upperType === 'INVOICE_IN')
              globalAttributes['type_invoice_in'] = ev.valueText;
            if (upperType === 'INVOICE_OUT')
              globalAttributes['type_invoice_out'] = ev.valueText;
            if (upperType === 'GOODS_RECEIPT')
              globalAttributes['type_inventory_receipt'] = ev.valueText;
            if (upperType === 'GOODS_ISSUE')
              globalAttributes['type_inventory_issue'] = ev.valueText;
            if (upperType === 'INVENTORY_ADJUSTMENT')
              globalAttributes['type_inventory_adjustment'] = ev.valueText;
          }
        }
      } else {
        attributes[ev.attrDefId] = ev.valueText;
        if (ev.attrDef?.code) {
          attributes[ev.attrDef.code] = ev.valueText;
        }
      }
    }

    // Fallback: Nếu is_valid chưa có trong globalAttributes nhưng có giá trị từ bảng erp_invoices
    if (
      (upperType === 'INVOICE' ||
        upperType === 'INVOICE_IN' ||
        upperType === 'INVOICE_OUT') &&
      invoiceIsValid !== null
    ) {
      const isValidDef = globalAttributeDefs.find((d) => d.code === 'is_valid');
      if (isValidDef) {
        if (globalAttributes['is_valid'] === undefined) {
          const valStr = invoiceIsValid ? 'true' : 'false';
          globalAttributes['is_valid'] = valStr;
          globalAttributes[isValidDef.id] = valStr;
        }
      }
    }

    return {
      entityType: upperType,
      entityId,
      categoryId,
      category,
      attributes,
      globalAttributes,
      globalAttributeDefs: globalAttributeDefs.map((d) => ({
        ...d,
        isActive: d.isActive,
      })),
      attributeValues: entityValues.map((ev) => ({
        id: ev.id,
        attrDefId: ev.attrDefId,
        attrCode: ev.attrDef?.code,
        attrName: ev.attrDef?.name,
        nameEn: ev.attrDef?.nameEn,
        fieldType: ev.attrDef?.fieldType,
        valueText: ev.valueText,
        isGlobal: ev.attrDef?.isGlobal || globalDefIds.has(ev.attrDefId),
      })),
    };
  }

  /**
   * Lưu cấu hình custom fields (category + attributes + globalAttributes) cho một entity bất kỳ
   */
  async saveEntityValues(
    entityType: string,
    entityId: string,
    dto: SaveEntityValuesDto,
  ) {
    const rawUpperType = (entityType || '').trim().toUpperCase();
    const upperType =
      rawUpperType === 'RECEIPT'
        ? 'GOODS_RECEIPT'
        : rawUpperType === 'ISSUE'
          ? 'GOODS_ISSUE'
          : rawUpperType === 'ADJUSTMENT'
            ? 'INVENTORY_ADJUSTMENT'
            : rawUpperType;

    const { categoryId, attributes = {}, globalAttributes = {} } = dto;

    return this.dataSource.transaction(async (manager) => {
      // 1. Check required GLOBAL attributes (Soft check without throwing exception)
      const globalDefs = await manager.find(ErpModuleAttributeDef, {
        where: [
          { isGlobal: true, moduleKeyGlobal: upperType, isDeleted: false },
          ...(rawUpperType !== upperType
            ? [
                {
                  isGlobal: true,
                  moduleKeyGlobal: rawUpperType,
                  isDeleted: false,
                },
              ]
            : []),
        ],
      });

      const globalDefMap = new Map<string, string>();
      for (const d of globalDefs) {
        globalDefMap.set(d.id, d.id);
        if (d.code) {
          const codeLower = d.code.trim().toLowerCase();
          globalDefMap.set(codeLower, d.id);
          if (codeLower === 'category') {
            if (upperType === 'INVOICE_IN') {
              globalDefMap.set('type_invoice_in', d.id);
              globalDefMap.set('invoice_type', d.id);
              globalDefMap.set('type', d.id);
            } else if (upperType === 'INVOICE_OUT') {
              globalDefMap.set('type_invoice_out', d.id);
              globalDefMap.set('invoice_type', d.id);
              globalDefMap.set('type', d.id);
            } else if (upperType === 'GOODS_RECEIPT') {
              globalDefMap.set('type_inventory_receipt', d.id);
              globalDefMap.set('receipt_type', d.id);
            } else if (upperType === 'GOODS_ISSUE') {
              globalDefMap.set('type_inventory_issue', d.id);
              globalDefMap.set('issue_type', d.id);
            } else if (upperType === 'INVENTORY_ADJUSTMENT') {
              globalDefMap.set('type_inventory_adjustment', d.id);
              globalDefMap.set('adjustment_type', d.id);
            }
          }
        }
      }

      // 2. Check required CATEGORY attributes nếu có categoryId
      const catDefMap = new Map<string, string>();
      if (categoryId) {
        const cat = await manager.findOne(ErpModuleCategory, {
          where: { id: categoryId, isDeleted: false },
          relations: { attributeDefs: true },
        });
        if (!cat) {
          throw new NotFoundException(
            `Không tìm thấy danh mục ID ${categoryId}`,
          );
        }
        for (const d of cat.attributeDefs || []) {
          if (!d.isDeleted) {
            catDefMap.set(d.id, d.id);
            if (d.code) {
              catDefMap.set(d.code.trim().toLowerCase(), d.id);
            }
          }
        }
      }

      // 3. Cập nhật category_id trên entity table
      if (
        upperType === 'INVOICE' ||
        upperType === 'INVOICE_IN' ||
        upperType === 'INVOICE_OUT'
      ) {
        let isValidValue: boolean | undefined = undefined;
        if (globalAttributes && typeof globalAttributes === 'object') {
          const isValidDefId = globalDefMap.get('is_valid');
          const rawVal =
            globalAttributes['is_valid'] ??
            (isValidDefId ? globalAttributes[isValidDefId] : undefined);
          if (rawVal !== undefined && rawVal !== null) {
            isValidValue =
              rawVal === true ||
              rawVal === 'true' ||
              rawVal === 1 ||
              rawVal === '1';
          }
        }

        if (isValidValue !== undefined) {
          await manager.query(
            `UPDATE erp_invoices SET category_id = $1, is_valid = $2, updated_at = now() WHERE id = $3`,
            [categoryId || null, isValidValue, entityId],
          );
        } else {
          await manager.query(
            `UPDATE erp_invoices SET category_id = $1, updated_at = now() WHERE id = $2`,
            [categoryId || null, entityId],
          );
        }
      } else if (upperType === 'BANK_TXN') {
        await manager.query(
          `UPDATE erp_bank_transactions SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (upperType === 'BOM') {
        const prodOrderCount = await manager.query(
          `SELECT COUNT(1) as count FROM erp_production_orders WHERE is_deleted = false AND (output_metadata->>'bomId' = $1 OR (output_metadata IS NULL AND finished_good_item_id = (SELECT finished_good_item_id FROM erp_boms WHERE id = $1)))`,
          [entityId],
        );
        if ((parseInt(prodOrderCount[0]?.count, 10) || 0) > 0) {
          throw new BadRequestException(
            'BOM đã phát sinh lệnh sản xuất, không thể chỉnh sửa thuộc tính.',
          );
        }
        await manager.query(
          `UPDATE erp_boms SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
        if (globalAttributes && typeof globalAttributes === 'object') {
          const versionAttrId = globalDefMap.get('version');
          const versionVal =
            globalAttributes.version ??
            (versionAttrId ? globalAttributes[versionAttrId] : undefined);
          if (
            versionVal !== undefined &&
            versionVal !== null &&
            String(versionVal).trim() !== ''
          ) {
            await manager.query(
              `UPDATE erp_boms SET version = $1, updated_at = now() WHERE id = $2`,
              [String(versionVal).trim(), entityId],
            );
          }
        }
      } else if (upperType === 'GOODS_RECEIPT') {
        await manager.query(
          `UPDATE erp_goods_receipts SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (upperType === 'GOODS_ISSUE') {
        await manager.query(
          `UPDATE erp_goods_issues SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      } else if (upperType === 'INVENTORY_ADJUSTMENT') {
        await manager.query(
          `UPDATE erp_inventory_adjustments SET category_id = $1, updated_at = now() WHERE id = $2`,
          [categoryId || null, entityId],
        );
      }

      // 4. Xóa các giá trị cũ
      await manager.delete(ErpEntityAttributeValue, {
        entityType: upperType,
        entityId,
      });
      if (rawUpperType !== upperType) {
        await manager.delete(ErpEntityAttributeValue, {
          entityType: rawUpperType,
          entityId,
        });
      }
      if (upperType === 'INVOICE_IN' || upperType === 'INVOICE_OUT') {
        await manager.delete(ErpEntityAttributeValue, {
          entityType: 'INVOICE',
          entityId,
        });
      }

      // 5. Lưu các giá trị mới (Deduplicated theo attrDefId để tránh duplicate key constraint)
      const isUuid = (str: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          str,
        );

      const valuesByAttrDefId = new Map<
        string,
        { categoryId: string | null; valueText: string }
      >();

      // Category attributes
      if (categoryId && attributes && typeof attributes === 'object') {
        for (const [key, rawVal] of Object.entries(attributes)) {
          if (rawVal === undefined || rawVal === null) continue;
          let strVal = '';
          if (typeof rawVal === 'object') {
            strVal = JSON.stringify(rawVal);
          } else {
            strVal = String(rawVal).trim();
          }
          if (strVal === '' || strVal === '[]' || strVal === '{}') continue;

          const attrDefId =
            catDefMap.get(key) ||
            catDefMap.get(key.trim().toLowerCase()) ||
            globalDefMap.get(key) ||
            globalDefMap.get(key.trim().toLowerCase()) ||
            (isUuid(key) ? key : null);

          if (attrDefId) {
            valuesByAttrDefId.set(attrDefId, {
              categoryId,
              valueText: strVal,
            });
          }
        }
      }

      // Global attributes (categoryId = null)
      if (globalAttributes && typeof globalAttributes === 'object') {
        for (const [key, rawVal] of Object.entries(globalAttributes)) {
          if (rawVal === undefined || rawVal === null) continue;
          let strVal = '';
          if (typeof rawVal === 'object') {
            strVal = JSON.stringify(rawVal);
          } else {
            strVal = String(rawVal).trim();
          }
          if (strVal === '' || strVal === '[]' || strVal === '{}') continue;

          const attrDefId =
            globalDefMap.get(key) ||
            globalDefMap.get(key.trim().toLowerCase()) ||
            catDefMap.get(key) ||
            catDefMap.get(key.trim().toLowerCase()) ||
            (isUuid(key) ? key : null);

          if (attrDefId) {
            valuesByAttrDefId.set(attrDefId, {
              categoryId: null,
              valueText: strVal,
            });
          }
        }
      }

      const newEntities: ErpEntityAttributeValue[] = [];
      for (const [attrDefId, item] of valuesByAttrDefId.entries()) {
        const entityVal = manager.create(ErpEntityAttributeValue, {
          entityType: upperType,
          entityId,
          categoryId: item.categoryId,
          attrDefId,
          valueText: item.valueText,
        });
        newEntities.push(entityVal);
      }

      if (newEntities.length > 0) {
        await manager.save(ErpEntityAttributeValue, newEntities);
      }
    });
  }
}
