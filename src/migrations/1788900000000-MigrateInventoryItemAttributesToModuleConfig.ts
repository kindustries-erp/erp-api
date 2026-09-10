import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateInventoryItemAttributesToModuleConfig1788900000000 implements MigrationInterface {
  name = 'MigrateInventoryItemAttributesToModuleConfig1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Kiểm tra tồn tại các bảng cần thiết
    const tablesExist = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_inventory_items', 'erp_module_attribute_defs', 'erp_entity_attribute_values');
    `);

    const tableNames = tablesExist.map((t: any) => t.table_name);
    if (
      !tableNames.includes('erp_inventory_items') ||
      !tableNames.includes('erp_module_attribute_defs') ||
      !tableNames.includes('erp_entity_attribute_values')
    ) {
      return;
    }

    // 2. Bổ sung các options còn thiếu vào uom và item_type trong erp_module_attribute_defs
    const uomDefRow = await queryRunner.query(`
      SELECT id, options FROM erp_module_attribute_defs
      WHERE module_key_global = 'INVENTORY_ITEM'
        AND code = 'uom'
        AND is_deleted = false
      LIMIT 1;
    `);

    if (uomDefRow.length > 0) {
      const currentOpts = Array.isArray(uomDefRow[0].options)
        ? uomDefRow[0].options
        : [];
      const existingValues = new Set(currentOpts.map((o: any) => o.value));

      const missingUoms = [
        {
          label: 'Cái',
          value: 'CAI',
          labels: { vi: 'Cái', en: 'Unit' },
          labelEn: 'Unit',
        },
        {
          label: 'Bộ',
          value: 'BO',
          labels: { vi: 'Bộ', en: 'Set' },
          labelEn: 'Set',
        },
        {
          label: 'Cuốn',
          value: 'CUON',
          labels: { vi: 'Cuốn', en: 'Roll/Book' },
          labelEn: 'Roll/Book',
        },
        {
          label: 'Con',
          value: 'CON',
          labels: { vi: 'Con', en: 'Piece' },
          labelEn: 'Piece',
        },
        {
          label: 'Gram (g)',
          value: 'GRAM',
          labels: { vi: 'Gram (g)', en: 'Gram (g)' },
          labelEn: 'Gram (g)',
        },
        {
          label: 'Sợi',
          value: 'SOI',
          labels: { vi: 'Sợi', en: 'Strand/Thread' },
          labelEn: 'Strand/Thread',
        },
        {
          label: 'Công',
          value: 'CONG',
          labels: { vi: 'Công', en: 'Labor / Shift' },
          labelEn: 'Labor / Shift',
        },
        {
          label: 'Piece (pcs)',
          value: 'PCS',
          labels: { vi: 'Piece (pcs)', en: 'Piece (pcs)' },
          labelEn: 'Piece (pcs)',
        },
      ];

      let updated = false;
      for (const m of missingUoms) {
        if (!existingValues.has(m.value)) {
          currentOpts.push(m);
          existingValues.add(m.value);
          updated = true;
        }
      }

      if (updated) {
        await queryRunner.query(
          `UPDATE erp_module_attribute_defs SET options = $1 WHERE id = $2`,
          [JSON.stringify(currentOpts), uomDefRow[0].id],
        );
      }
    }

    // 3. Lấy danh sách Attribute Defs của INVENTORY_ITEM
    const defs = await queryRunner.query(`
      SELECT id, code FROM erp_module_attribute_defs
      WHERE module_key_global = 'INVENTORY_ITEM'
        AND is_global = true
        AND is_deleted = false;
    `);

    const defMap: Record<string, string> = {};
    for (const d of defs) {
      defMap[d.code.toLowerCase()] = d.id;
    }

    const itemFeaturesDefId =
      defMap['item_features'] ||
      defMap['item_attributes'] ||
      defMap['business_features'];
    const uomDefId = defMap['uom'];
    const itemTypeDefId = defMap['item_type'];
    const trackingPolicyDefId = defMap['tracking_policy'];

    // 4. Migrate mảng attributes: text[] hiện có sang erp_entity_attribute_values
    if (itemFeaturesDefId) {
      await queryRunner.query(
        `
        INSERT INTO erp_entity_attribute_values (
          id, entity_type, entity_id, category_id, attr_def_id, value_text, created_at, updated_at
        )
        SELECT 
          gen_random_uuid(),
          'INVENTORY_ITEM',
          i.id,
          NULL,
          $1,
          to_json(i.attributes)::text,
          now(),
          now()
        FROM erp_inventory_items i
        WHERE i.attributes IS NOT NULL 
          AND array_length(i.attributes, 1) > 0
          AND NOT EXISTS (
            SELECT 1 FROM erp_entity_attribute_values eav
            WHERE eav.entity_type = 'INVENTORY_ITEM'
              AND eav.entity_id = i.id
              AND eav.attr_def_id = $1
          );
      `,
        [itemFeaturesDefId],
      );
    }

    // 5. Đồng bộ giá trị UOM sang erp_entity_attribute_values nếu có
    if (uomDefId) {
      await queryRunner.query(
        `
        INSERT INTO erp_entity_attribute_values (
          id, entity_type, entity_id, category_id, attr_def_id, value_text, created_at, updated_at
        )
        SELECT 
          gen_random_uuid(),
          'INVENTORY_ITEM',
          i.id,
          NULL,
          $1,
          u.code,
          now(),
          now()
        FROM erp_inventory_items i
        JOIN erp_uoms u ON u.id = i.uom_id
        WHERE NOT EXISTS (
          SELECT 1 FROM erp_entity_attribute_values eav
          WHERE eav.entity_type = 'INVENTORY_ITEM'
            AND eav.entity_id = i.id
            AND eav.attr_def_id = $1
        );
      `,
        [uomDefId],
      );
    }

    // 6. Đồng bộ giá trị Item Type sang erp_entity_attribute_values nếu có (chuẩn hoá alias RAW -> RAW_MATERIAL, FG -> FINISHED_GOODS)
    if (itemTypeDefId) {
      await queryRunner.query(
        `
        INSERT INTO erp_entity_attribute_values (
          id, entity_type, entity_id, category_id, attr_def_id, value_text, created_at, updated_at
        )
        SELECT 
          gen_random_uuid(),
          'INVENTORY_ITEM',
          i.id,
          NULL,
          $1,
          CASE 
            WHEN UPPER(it.code) = 'RAW' THEN 'RAW_MATERIAL'
            WHEN UPPER(it.code) = 'FG' THEN 'FINISHED_GOODS'
            WHEN UPPER(it.code) = 'PART' THEN 'SPARE_PART'
            ELSE it.code
          END,
          now(),
          now()
        FROM erp_inventory_items i
        JOIN erp_item_types it ON it.id = i.item_type_id
        WHERE NOT EXISTS (
          SELECT 1 FROM erp_entity_attribute_values eav
          WHERE eav.entity_type = 'INVENTORY_ITEM'
            AND eav.entity_id = i.id
            AND eav.attr_def_id = $1
        );
      `,
        [itemTypeDefId],
      );
    }

    // 7. Đồng bộ giá trị Tracking Policy sang erp_entity_attribute_values nếu có
    if (trackingPolicyDefId) {
      await queryRunner.query(
        `
        INSERT INTO erp_entity_attribute_values (
          id, entity_type, entity_id, category_id, attr_def_id, value_text, created_at, updated_at
        )
        SELECT 
          gen_random_uuid(),
          'INVENTORY_ITEM',
          i.id,
          NULL,
          $1,
          tp.code,
          now(),
          now()
        FROM erp_inventory_items i
        JOIN erp_tracking_policies tp ON tp.id = i.tracking_policy_id
        WHERE NOT EXISTS (
          SELECT 1 FROM erp_entity_attribute_values eav
          WHERE eav.entity_type = 'INVENTORY_ITEM'
            AND eav.entity_id = i.id
            AND eav.attr_def_id = $1
        );
      `,
        [trackingPolicyDefId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM erp_entity_attribute_values
      WHERE entity_type = 'INVENTORY_ITEM';
    `);
  }
}
