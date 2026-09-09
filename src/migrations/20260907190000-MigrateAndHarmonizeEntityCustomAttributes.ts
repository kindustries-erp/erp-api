import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateAndHarmonizeEntityCustomAttributes20260907190000 implements MigrationInterface {
  name = 'MigrateAndHarmonizeEntityCustomAttributes20260907190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // 1. ENSURE SYSTEM ATTRIBUTE DEFS FOR PRODUCTION
    // ========================================================================
    const defaultProductionOptions = JSON.stringify([
      {
        value: 'ASSEMBLY',
        label: 'Lắp ráp thành phẩm xe',
        labelEn: 'Vehicle Final Assembly',
        labels: {
          vi: 'Lắp ráp thành phẩm xe',
          en: 'Vehicle Final Assembly',
        },
      },
      {
        value: 'SUB_ASSEMBLY',
        label: 'Lắp ráp cụm chi tiết / Bán thành phẩm',
        labelEn: 'Sub-Assembly / Semi-Finished Goods',
        labels: {
          vi: 'Lắp ráp cụm chi tiết / Bán thành phẩm',
          en: 'Sub-Assembly / Semi-Finished Goods',
        },
      },
      {
        value: 'REPAIR',
        label: 'Gia công lại & Sửa chữa kỹ thuật',
        labelEn: 'Rework & Technical Repair',
        labels: {
          vi: 'Gia công lại & Sửa chữa kỹ thuật',
          en: 'Rework & Technical Repair',
        },
      },
      {
        value: 'OTHER',
        label: 'Khác',
        labelEn: 'Other',
        labels: { vi: 'Khác', en: 'Other' },
      },
    ]);

    const existingProdType = await queryRunner.query(`
      SELECT id FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'PRODUCTION'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type_production_order', 'production_type', 'type')
      LIMIT 1;
    `);

    let prodDefId: string;
    if (existingProdType && existingProdType.length > 0) {
      prodDefId = existingProdType[0].id;
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_production_order',
            "name" = 'Loại lệnh sản xuất',
            "name_en" = 'Production Order Type',
            "field_type" = 'SELECT',
            "options" = $1::jsonb
        WHERE "id" = $2;
      `,
        [defaultProductionOptions, prodDefId],
      );
    } else {
      const inserted = await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'PRODUCTION', 'type_production_order', 'Loại lệnh sản xuất', 'Production Order Type',
          'SELECT', $1::jsonb, 0, false, true, true, false,
          now(), now()
        )
        RETURNING "id";
      `,
        [defaultProductionOptions],
      );
      prodDefId = inserted[0].id;
    }

    // ========================================================================
    // 2. RETRIEVE ALL SYSTEM ATTRIBUTE DEF IDS
    // ========================================================================
    const defIds = await queryRunner.query(`
      SELECT module_key_global, code, id 
      FROM "erp_bom_attribute_defs"
      WHERE is_deleted = false 
        AND is_global = true
        AND is_system = true;
    `);

    const defMap = new Map<string, string>();
    for (const d of defIds) {
      defMap.set(`${d.module_key_global}:${d.code}`, d.id);
    }

    const grDefId = defMap.get('GOODS_RECEIPT:type_inventory_receipt');
    const giDefId = defMap.get('GOODS_ISSUE:type_inventory_issue');
    const iaDefId = defMap.get(
      'INVENTORY_ADJUSTMENT:type_inventory_adjustment',
    );
    const invInDefId = defMap.get('INVOICE_IN:type_invoice_in');
    const invOutDefId = defMap.get('INVOICE_OUT:type_invoice_out');
    const bomColorDefId = defMap.get('BOM:color');
    const bomVerDefId = defMap.get('BOM:version');

    // ========================================================================
    // 3. BACKFILL GOODS RECEIPTS (GOODS_RECEIPT)
    // ========================================================================
    if (grDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'GOODS_RECEIPT',
          gr.id,
          $1,
          CASE 
            WHEN gr.purchase_order_id IS NOT NULL THEN 'PO'
            WHEN gr.production_order_id IS NOT NULL THEN 'PRODUCTION'
            ELSE 'OTHER'
          END,
          now(),
          now()
        FROM "erp_goods_receipts" gr
        WHERE gr.is_deleted = false
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type = 'GOODS_RECEIPT'
              AND eav.entity_id = gr.id
              AND eav.attr_def_id = $1
          );
      `,
        [grDefId],
      );
    }

    // ========================================================================
    // 4. BACKFILL GOODS ISSUES (GOODS_ISSUE)
    // ========================================================================
    if (giDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'GOODS_ISSUE',
          gi.id,
          $1,
          CASE 
            WHEN UPPER(COALESCE(gi.issue_type, '')) IN ('SALES_DELIVERY', 'SALES', 'SALE') THEN 'SALE'
            WHEN UPPER(COALESCE(gi.issue_type, '')) = 'PRODUCTION' THEN 'PRODUCTION'
            WHEN UPPER(COALESCE(gi.issue_type, '')) = 'WARRANTY' THEN 'WARRANTY'
            WHEN UPPER(COALESCE(gi.issue_type, '')) IN ('SCRAP', 'LOSS') THEN 'SCRAP'
            ELSE 'OTHER'
          END,
          now(),
          now()
        FROM "erp_goods_issues" gi
        WHERE gi.is_deleted = false
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type = 'GOODS_ISSUE'
              AND eav.entity_id = gi.id
              AND eav.attr_def_id = $1
          );
      `,
        [giDefId],
      );
    }

    // ========================================================================
    // 5. BACKFILL INVENTORY ADJUSTMENTS (INVENTORY_ADJUSTMENT)
    // ========================================================================
    if (iaDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'INVENTORY_ADJUSTMENT',
          ia.id,
          $1,
          'PERIODIC',
          now(),
          now()
        FROM "erp_inventory_adjustments" ia
        WHERE ia.is_deleted = false
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type = 'INVENTORY_ADJUSTMENT'
              AND eav.entity_id = ia.id
              AND eav.attr_def_id = $1
          );
      `,
        [iaDefId],
      );
    }

    // ========================================================================
    // 6. BACKFILL INVOICES (INVOICE_IN & INVOICE_OUT)
    // ========================================================================
    if (invInDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'INVOICE_IN',
          inv.id,
          $1,
          'PURCHASE_GOODS',
          now(),
          now()
        FROM "erp_invoices" inv
        WHERE inv.is_deleted = false
          AND (inv.tax_invoice_type IS NULL OR inv.tax_invoice_type != 'OUT')
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type IN ('INVOICE', 'INVOICE_IN')
              AND eav.entity_id = inv.id
              AND eav.attr_def_id = $1
          );
      `,
        [invInDefId],
      );
    }

    if (invOutDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'INVOICE_OUT',
          inv.id,
          $1,
          'SALE_GOODS',
          now(),
          now()
        FROM "erp_invoices" inv
        WHERE inv.is_deleted = false
          AND inv.tax_invoice_type = 'OUT'
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type IN ('INVOICE', 'INVOICE_OUT')
              AND eav.entity_id = inv.id
              AND eav.attr_def_id = $1
          );
      `,
        [invOutDefId],
      );
    }

    // ========================================================================
    // 7. BACKFILL PRODUCTION ORDERS (PRODUCTION)
    // ========================================================================
    if (prodDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'PRODUCTION',
          po.id,
          $1,
          'ASSEMBLY',
          now(),
          now()
        FROM "erp_production_orders" po
        WHERE po.is_deleted = false
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type = 'PRODUCTION'
              AND eav.entity_id = po.id
              AND eav.attr_def_id = $1
          );
      `,
        [prodDefId],
      );
    }

    // ========================================================================
    // 8. BACKFILL BOMS (BOM: version & color)
    // ========================================================================
    if (bomVerDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'BOM',
          b.id,
          $1,
          COALESCE(NULLIF(TRIM(b.version), ''), '1'),
          now(),
          now()
        FROM "erp_boms" b
        WHERE b.is_deleted = false
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type = 'BOM'
              AND eav.entity_id = b.id
              AND eav.attr_def_id = $1
          );
      `,
        [bomVerDefId],
      );
    }

    if (bomColorDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'BOM',
          b.id,
          $1,
          CASE 
            WHEN b.bom_name ILIKE '%Xanh%' OR b.bom_code ILIKE '%XANH%' THEN 'blue'
            WHEN b.bom_name ILIKE '%Xám%' OR b.bom_code ILIKE '%XAM%' THEN 'gray'
            WHEN b.bom_name ILIKE '%Trắng%' OR b.bom_code ILIKE '%TRANG%' THEN 'white'
            WHEN b.bom_name ILIKE '%Đỏ%' OR b.bom_code ILIKE '%DO%' THEN 'red'
            WHEN b.bom_name ILIKE '%Đen nhám%' OR b.bom_code ILIKE '%DEN_NHAM%' THEN 'matte_black'
            WHEN b.bom_name ILIKE '%Đen%' OR b.bom_code ILIKE '%DEN%' THEN 'black'
            ELSE 'blue'
          END,
          now(),
          now()
        FROM "erp_boms" b
        WHERE b.is_deleted = false
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type = 'BOM'
              AND eav.entity_id = b.id
              AND eav.attr_def_id = $1
          );
      `,
        [bomColorDefId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Hoàn tác các bản ghi EAV của PRODUCTION được tạo bởi migration này
    await queryRunner.query(`
      DELETE FROM "erp_entity_attribute_values"
      WHERE "entity_type" = 'PRODUCTION';
    `);

    await queryRunner.query(`
      DELETE FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'PRODUCTION' AND "code" = 'type_production_order';
    `);
  }
}
