import { MigrationInterface, QueryRunner } from 'typeorm';

export class HarmonizeInvoiceCategoryAttributeDefs1789100000000 implements MigrationInterface {
  name = 'HarmonizeInvoiceCategoryAttributeDefs1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const defaultInvoiceInOptions = JSON.stringify([
      {
        value: 'PURCHASE_GOODS',
        label: 'Mua hàng hóa / NVL',
        labelEn: 'Goods & Raw Materials Purchase',
        labels: {
          vi: 'Mua hàng hóa / NVL',
          en: 'Goods & Raw Materials Purchase',
        },
      },
      {
        value: 'EXPENSE_OPEX',
        label: 'Chi phí quản lý & Vận hành (OPEX)',
        labelEn: 'Operating Expenses (OPEX)',
        labels: {
          vi: 'Chi phí quản lý & Vận hành (OPEX)',
          en: 'Operating Expenses (OPEX)',
        },
      },
      {
        value: 'SERVICE_FEE',
        label: 'Dịch vụ & Gia công ngoài',
        labelEn: 'Services & Subcontracting',
        labels: {
          vi: 'Dịch vụ & Gia công ngoài',
          en: 'Services & Subcontracting',
        },
      },
      {
        value: 'FIXED_ASSET',
        label: 'Tài sản cố định & CCDC',
        labelEn: 'Fixed Assets & Tools',
        labels: {
          vi: 'Tài sản cố định & CCDC',
          en: 'Fixed Assets & Tools',
        },
      },
      {
        value: 'OTHER',
        label: 'Khác',
        labelEn: 'Other',
        labels: { vi: 'Khác', en: 'Other' },
      },
    ]);

    const defaultInvoiceOutOptions = JSON.stringify([
      {
        value: 'SALE_GOODS',
        label: 'Bán hàng hóa / Xe / Phụ tùng',
        labelEn: 'Goods & Parts Sales',
        labels: {
          vi: 'Bán hàng hóa / Xe / Phụ tùng',
          en: 'Goods & Parts Sales',
        },
      },
      {
        value: 'SALE_SERVICE',
        label: 'Dịch vụ sửa chữa & Garage',
        labelEn: 'Service & Repair Sales',
        labels: {
          vi: 'Dịch vụ sửa chữa & Garage',
          en: 'Service & Repair Sales',
        },
      },
      {
        value: 'SALE_FINANCIAL',
        label: 'Doanh thu hoạt động tài chính',
        labelEn: 'Financial Revenue',
        labels: {
          vi: 'Doanh thu hoạt động tài chính',
          en: 'Financial Revenue',
        },
      },
      {
        value: 'OTHER_INCOME',
        label: 'Thu nhập khác',
        labelEn: 'Other Income',
        labels: { vi: 'Thu nhập khác', en: 'Other Income' },
      },
    ]);

    // 1. Determine table name (erp_module_attribute_defs or erp_bom_attribute_defs)
    const attrDefTableRes = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_module_attribute_defs', 'erp_bom_attribute_defs')
      ORDER BY CASE WHEN table_name = 'erp_module_attribute_defs' THEN 1 ELSE 2 END
      LIMIT 1;
    `);
    const attrDefTable =
      attrDefTableRes?.[0]?.table_name || 'erp_module_attribute_defs';

    // 2. Update INVOICE_IN system attribute code to 'category'
    const existingInDef = await queryRunner.query(`
      SELECT id FROM "${attrDefTable}"
      WHERE "module_key_global" = 'INVOICE_IN'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type_invoice_in', 'category', 'invoice_type', 'type')
      ORDER BY CASE WHEN "code" = 'type_invoice_in' THEN 1 WHEN "code" = 'category' THEN 2 ELSE 3 END
      LIMIT 1;
    `);

    if (existingInDef && existingInDef.length > 0) {
      await queryRunner.query(
        `
        UPDATE "${attrDefTable}"
        SET "code" = 'category',
            "is_system" = true,
            "is_global" = true,
            "name" = 'Phân loại hóa đơn mua vào',
            "name_en" = 'Input Invoice Category',
            "field_type" = 'SELECT',
            "options" = COALESCE("options", $1::jsonb),
            "updated_at" = NOW()
        WHERE "id" = $2;
      `,
        [defaultInvoiceInOptions, existingInDef[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "${attrDefTable}" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'INVOICE_IN', 'category', 'Phân loại hóa đơn mua vào', 'Input Invoice Category',
          'SELECT', $1::jsonb, 0, false, true, true, false,
          NOW(), NOW()
        );
      `,
        [defaultInvoiceInOptions],
      );
    }

    // 3. Update INVOICE_OUT system attribute code to 'category'
    const existingOutDef = await queryRunner.query(`
      SELECT id FROM "${attrDefTable}"
      WHERE "module_key_global" = 'INVOICE_OUT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type_invoice_out', 'category', 'invoice_type', 'type')
      ORDER BY CASE WHEN "code" = 'type_invoice_out' THEN 1 WHEN "code" = 'category' THEN 2 ELSE 3 END
      LIMIT 1;
    `);

    if (existingOutDef && existingOutDef.length > 0) {
      await queryRunner.query(
        `
        UPDATE "${attrDefTable}"
        SET "code" = 'category',
            "is_system" = true,
            "is_global" = true,
            "name" = 'Phân loại hóa đơn bán ra',
            "name_en" = 'Output Invoice Category',
            "field_type" = 'SELECT',
            "options" = COALESCE("options", $1::jsonb),
            "updated_at" = NOW()
        WHERE "id" = $2;
      `,
        [defaultInvoiceOutOptions, existingOutDef[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "${attrDefTable}" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'INVOICE_OUT', 'category', 'Phân loại hóa đơn bán ra', 'Output Invoice Category',
          'SELECT', $1::jsonb, 0, false, true, true, false,
          NOW(), NOW()
        );
      `,
        [defaultInvoiceOutOptions],
      );
    }

    // 4. Backfill missing EAVs for INVOICE_IN
    await queryRunner.query(`
      INSERT INTO "erp_entity_attribute_values" (
        "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(),
        'INVOICE_IN',
        inv.id,
        def.id,
        'PURCHASE_GOODS',
        NOW(),
        NOW()
      FROM "erp_invoices" inv
      CROSS JOIN (
        SELECT id FROM "${attrDefTable}"
        WHERE "module_key_global" = 'INVOICE_IN' AND "code" = 'category' AND "is_deleted" = false
        LIMIT 1
      ) def
      LEFT JOIN "erp_entity_attribute_values" eav 
        ON eav.entity_type IN ('INVOICE', 'INVOICE_IN') AND eav.entity_id = inv.id AND eav.attr_def_id = def.id
      WHERE eav.id IS NULL 
        AND inv.is_deleted = false 
        AND (inv.direction = 'IN' OR inv.tax_invoice_type IS NULL OR inv.tax_invoice_type != 'OUT');
    `);

    // 5. Backfill missing EAVs for INVOICE_OUT
    await queryRunner.query(`
      INSERT INTO "erp_entity_attribute_values" (
        "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(),
        'INVOICE_OUT',
        inv.id,
        def.id,
        'SALE_GOODS',
        NOW(),
        NOW()
      FROM "erp_invoices" inv
      CROSS JOIN (
        SELECT id FROM "${attrDefTable}"
        WHERE "module_key_global" = 'INVOICE_OUT' AND "code" = 'category' AND "is_deleted" = false
        LIMIT 1
      ) def
      LEFT JOIN "erp_entity_attribute_values" eav 
        ON eav.entity_type IN ('INVOICE', 'INVOICE_OUT') AND eav.entity_id = inv.id AND eav.attr_def_id = def.id
      WHERE eav.id IS NULL 
        AND inv.is_deleted = false 
        AND (inv.direction = 'OUT' OR inv.tax_invoice_type = 'OUT');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const attrDefTableRes = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_module_attribute_defs', 'erp_bom_attribute_defs')
      ORDER BY CASE WHEN table_name = 'erp_module_attribute_defs' THEN 1 ELSE 2 END
      LIMIT 1;
    `);
    const attrDefTable =
      attrDefTableRes?.[0]?.table_name || 'erp_module_attribute_defs';

    await queryRunner.query(`
      UPDATE "${attrDefTable}"
      SET "code" = 'type_invoice_in',
          "name" = 'Phân loại hóa đơn mua vào',
          "name_en" = 'Input Invoice Type',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'INVOICE_IN' AND "code" = 'category' AND "is_system" = true;
    `);

    await queryRunner.query(`
      UPDATE "${attrDefTable}"
      SET "code" = 'type_invoice_out',
          "name" = 'Phân loại hóa đơn bán ra',
          "name_en" = 'Output Invoice Type',
          "updated_at" = NOW()
      WHERE "module_key_global" = 'INVOICE_OUT' AND "code" = 'category' AND "is_system" = true;
    `);
  }
}
