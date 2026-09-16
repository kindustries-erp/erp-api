import { MigrationInterface, QueryRunner } from 'typeorm';

export class HarmonizeWarehouseVoucherCategoryAttributeDefs1789000000000 implements MigrationInterface {
  name = 'HarmonizeWarehouseVoucherCategoryAttributeDefs1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Update code to 'category' for GOODS_RECEIPT system attribute
    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "code" = 'category',
          "is_system" = true,
          "is_global" = true,
          "name" = 'Loại nhập kho',
          "name_en" = 'Goods Receipt Category',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'GOODS_RECEIPT'
        AND ("code" = 'type_inventory_receipt' OR "is_system" = true)
        AND "is_deleted" = false;
    `);

    // 2. Update code to 'category' for GOODS_ISSUE system attribute
    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "code" = 'category',
          "is_system" = true,
          "is_global" = true,
          "name" = 'Loại xuất kho',
          "name_en" = 'Goods Issue Category',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'GOODS_ISSUE'
        AND ("code" = 'type_inventory_issue' OR "is_system" = true)
        AND "is_deleted" = false;
    `);

    // 3. Update code to 'category' for INVENTORY_ADJUSTMENT system attribute
    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "code" = 'category',
          "is_system" = true,
          "is_global" = true,
          "name" = 'Lý do điều chỉnh',
          "name_en" = 'Adjustment Category',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'INVENTORY_ADJUSTMENT'
        AND ("code" = 'type_inventory_adjustment' OR "is_system" = true)
        AND "is_deleted" = false;
    `);

    // 4. Backfill missing EAVs for Goods Receipts
    await queryRunner.query(`
      INSERT INTO "erp_entity_attribute_values" (
        "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(),
        'GOODS_RECEIPT',
        gr.id,
        def.id,
        CASE 
          WHEN gr.purchase_order_id IS NOT NULL THEN 'PO'
          WHEN gr.production_order_id IS NOT NULL THEN 'PRODUCTION'
          ELSE 'OTHER'
        END,
        NOW(),
        NOW()
      FROM "erp_goods_receipts" gr
      CROSS JOIN (
        SELECT id FROM "erp_module_attribute_defs"
        WHERE "module_key_global" = 'GOODS_RECEIPT' AND "code" = 'category' AND "is_deleted" = false
        LIMIT 1
      ) def
      LEFT JOIN "erp_entity_attribute_values" eav 
        ON eav.entity_type = 'GOODS_RECEIPT' AND eav.entity_id = gr.id AND eav.attr_def_id = def.id
      WHERE eav.id IS NULL AND gr.is_deleted = false;
    `);

    // 5. Backfill missing EAVs for Goods Issues
    await queryRunner.query(`
      INSERT INTO "erp_entity_attribute_values" (
        "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(),
        'GOODS_ISSUE',
        gi.id,
        def.id,
        CASE 
          WHEN gi.production_order_id IS NOT NULL OR gi.issue_type = 'PRODUCTION' THEN 'PRODUCTION'
          WHEN gi.sales_order_id IS NOT NULL OR gi.issue_type = 'SALE' OR gi.issue_type = 'SALES' THEN 'SALE'
          WHEN gi.issue_type = 'WARRANTY' THEN 'WARRANTY'
          WHEN gi.issue_type = 'SCRAP' THEN 'SCRAP'
          ELSE 'OTHER'
        END,
        NOW(),
        NOW()
      FROM "erp_goods_issues" gi
      CROSS JOIN (
        SELECT id FROM "erp_module_attribute_defs"
        WHERE "module_key_global" = 'GOODS_ISSUE' AND "code" = 'category' AND "is_deleted" = false
        LIMIT 1
      ) def
      LEFT JOIN "erp_entity_attribute_values" eav 
        ON eav.entity_type = 'GOODS_ISSUE' AND eav.entity_id = gi.id AND eav.attr_def_id = def.id
      WHERE eav.id IS NULL AND gi.is_deleted = false;
    `);

    // 6. Backfill missing EAVs for Inventory Adjustments
    await queryRunner.query(`
      INSERT INTO "erp_entity_attribute_values" (
        "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(),
        'INVENTORY_ADJUSTMENT',
        ia.id,
        def.id,
        'PERIODIC',
        NOW(),
        NOW()
      FROM "erp_inventory_adjustments" ia
      CROSS JOIN (
        SELECT id FROM "erp_module_attribute_defs"
        WHERE "module_key_global" = 'INVENTORY_ADJUSTMENT' AND "code" = 'category' AND "is_deleted" = false
        LIMIT 1
      ) def
      LEFT JOIN "erp_entity_attribute_values" eav 
        ON eav.entity_type = 'INVENTORY_ADJUSTMENT' AND eav.entity_id = ia.id AND eav.attr_def_id = def.id
      WHERE eav.id IS NULL AND ia.is_deleted = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "code" = 'type_inventory_receipt',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'GOODS_RECEIPT' AND "code" = 'category';
    `);

    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "code" = 'type_inventory_issue',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'GOODS_ISSUE' AND "code" = 'category';
    `);

    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "code" = 'type_inventory_adjustment',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'INVENTORY_ADJUSTMENT' AND "code" = 'category';
    `);
  }
}
