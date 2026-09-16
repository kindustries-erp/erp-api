import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveWarehouseSubcategoriesAndAddShowroomIssueCategory1789400000000 implements MigrationInterface {
  name = 'RemoveWarehouseSubcategoriesAndAddShowroomIssueCategory1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Determine active table names (erp_module_* or legacy erp_bom_*)
    const modAttrDefExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs'
    `);
    const attrDefTable =
      modAttrDefExists.length > 0
        ? 'erp_module_attribute_defs'
        : 'erp_bom_attribute_defs';

    const modCatExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_categories'
    `);
    const catTable =
      modCatExists.length > 0 ? 'erp_module_categories' : 'erp_bom_categories';

    // 2. Remove subcategory EAV values and Attribute Definitions for warehouse vouchers
    const subcategoryDefs = await queryRunner.query(
      `
      SELECT id FROM "${attrDefTable}"
      WHERE "module_key_global" IN ('GOODS_RECEIPT', 'GOODS_ISSUE', 'INVENTORY_ADJUSTMENT')
        AND "code" = 'subcategory';
    `,
    );

    if (subcategoryDefs && subcategoryDefs.length > 0) {
      const defIds = subcategoryDefs.map((d: any) => `'${d.id}'`).join(', ');
      const eavTableExists = await queryRunner.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'erp_entity_attribute_values'
      `);
      if (eavTableExists.length > 0) {
        await queryRunner.query(`
          DELETE FROM "erp_entity_attribute_values"
          WHERE "attr_def_id" IN (${defIds});
        `);
      }

      await queryRunner.query(`
        DELETE FROM "${attrDefTable}"
        WHERE "id" IN (${defIds});
      `);
    }

    // 3. Update category for GOODS_ISSUE: Replace SCRAP/SHOWROOM with INTERNAL
    await queryRunner.query(`
      UPDATE "${catTable}"
      SET "code" = 'INTERNAL',
          "name" = 'Xuất nội bộ / Trưng bày',
          "name_en" = 'Internal Use / Showroom Issue',
          "description" = 'Xuất hàng hóa / sản phẩm phục vụ sử dụng nội bộ, trưng bày showroom, lái thử hoặc sự kiện',
          "is_active" = true,
          "is_deleted" = false,
          "updated_at" = NOW()
      WHERE "module_key" = 'GOODS_ISSUE' AND "code" IN ('SCRAP', 'SHOWROOM');
    `);

    // Ensure category INTERNAL exists
    await queryRunner.query(`
      INSERT INTO "${catTable}" (
        "id", "module_key", "code", "name", "name_en", "description", "is_active", "is_deleted", "created_at", "updated_at"
      ) VALUES (
        gen_random_uuid(), 'GOODS_ISSUE', 'INTERNAL', 'Xuất nội bộ / Trưng bày', 'Internal Use / Showroom Issue',
        'Xuất hàng hóa / sản phẩm phục vụ sử dụng nội bộ, trưng bày showroom, lái thử hoặc sự kiện', true, false, NOW(), NOW()
      ) ON CONFLICT ("module_key", "code") DO UPDATE
      SET "name" = EXCLUDED."name",
          "name_en" = EXCLUDED."name_en",
          "description" = EXCLUDED."description",
          "is_active" = true,
          "is_deleted" = false,
          "updated_at" = NOW();
    `);

    // 4. Update default system attribute options for GOODS_ISSUE category
    const giOptions = JSON.stringify([
      {
        value: 'SALE',
        label: 'Xuất bán hàng (SO)',
        labelEn: 'Sales Delivery (SO)',
        labels: { vi: 'Xuất bán hàng (SO)', en: 'Sales Delivery (SO)' },
      },
      {
        value: 'PRODUCTION',
        label: 'Xuất sản xuất (NVL)',
        labelEn: 'Manufacturing Material Issue',
        labels: {
          vi: 'Xuất sản xuất (NVL)',
          en: 'Manufacturing Material Issue',
        },
      },
      {
        value: 'WARRANTY',
        label: 'Xuất bảo hành',
        labelEn: 'Warranty Replacement Issue',
        labels: {
          vi: 'Xuất bảo hành',
          en: 'Warranty Replacement Issue',
        },
      },
      {
        value: 'INTERNAL',
        label: 'Xuất nội bộ / Trưng bày',
        labelEn: 'Internal Use / Showroom Issue',
        labels: {
          vi: 'Xuất nội bộ / Trưng bày',
          en: 'Internal Use / Showroom Issue',
        },
      },
      {
        value: 'OTHER',
        label: 'Xuất khác',
        labelEn: 'Other Issue',
        labels: { vi: 'Xuất khác', en: 'Other Issue' },
      },
    ]);

    await queryRunner.query(
      `
      UPDATE "${attrDefTable}"
      SET "options" = $1::jsonb,
          "updated_at" = NOW()
      WHERE "module_key_global" = 'GOODS_ISSUE'
        AND "code" IN ('category', 'type_inventory_issue')
        AND "is_deleted" = false;
    `,
      [giOptions],
    );

    // 5. Backfill/migrate legacy data in erp_goods_issues and erp_entity_attribute_values
    const giTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_goods_issues'
    `);
    if (giTableExists.length > 0) {
      await queryRunner.query(`
        UPDATE "erp_goods_issues"
        SET "issue_type" = 'INTERNAL', "updated_at" = NOW()
        WHERE "issue_type" IN ('SCRAP', 'SHOWROOM');
      `);
    }

    const eavTableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_entity_attribute_values'
    `);
    if (eavTableExists.length > 0) {
      await queryRunner.query(`
        UPDATE "erp_entity_attribute_values"
        SET "value_text" = 'INTERNAL', "updated_at" = NOW()
        WHERE "entity_type" = 'GOODS_ISSUE' AND "value_text" IN ('SCRAP', 'SHOWROOM');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const modCatExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_categories'
    `);
    const catTable =
      modCatExists.length > 0 ? 'erp_module_categories' : 'erp_bom_categories';

    const modAttrDefExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs'
    `);
    const attrDefTable =
      modAttrDefExists.length > 0
        ? 'erp_module_attribute_defs'
        : 'erp_bom_attribute_defs';

    // Revert category INTERNAL -> SCRAP
    await queryRunner.query(`
      UPDATE "${catTable}"
      SET "code" = 'SCRAP',
          "name" = 'Xuất hủy / Hao hụt',
          "name_en" = 'Scrap & Disposal Issue',
          "description" = 'Xuất hủy hàng hỏng, hao hụt hoặc thanh lý',
          "updated_at" = NOW()
      WHERE "module_key" = 'GOODS_ISSUE' AND "code" = 'INTERNAL';
    `);

    // Revert options in attribute def
    const oldGiOptions = JSON.stringify([
      {
        value: 'SALE',
        label: 'Xuất bán hàng (SO)',
        labelEn: 'Sales Delivery (SO)',
        labels: { vi: 'Xuất bán hàng (SO)', en: 'Sales Delivery (SO)' },
      },
      {
        value: 'PRODUCTION',
        label: 'Xuất sản xuất (NVL)',
        labelEn: 'Manufacturing Material Issue',
        labels: {
          vi: 'Xuất sản xuất (NVL)',
          en: 'Manufacturing Material Issue',
        },
      },
      {
        value: 'WARRANTY',
        label: 'Xuất bảo hành',
        labelEn: 'Warranty Replacement Issue',
        labels: {
          vi: 'Xuất bảo hành',
          en: 'Warranty Replacement Issue',
        },
      },
      {
        value: 'SCRAP',
        label: 'Xuất hủy / Hao hụt',
        labelEn: 'Scrap & Disposal Issue',
        labels: {
          vi: 'Xuất hủy / Hao hụt',
          en: 'Scrap & Disposal Issue',
        },
      },
      {
        value: 'OTHER',
        label: 'Xuất khác',
        labelEn: 'Other Issue',
        labels: { vi: 'Xuất khác', en: 'Other Issue' },
      },
    ]);

    await queryRunner.query(
      `
      UPDATE "${attrDefTable}"
      SET "options" = $1::jsonb,
          "updated_at" = NOW()
      WHERE "module_key_global" = 'GOODS_ISSUE'
        AND "code" IN ('category', 'type_inventory_issue');
    `,
      [oldGiOptions],
    );

    // Revert erp_goods_issues & EAV
    await queryRunner.query(`
      UPDATE "erp_goods_issues"
      SET "issue_type" = 'SCRAP', "updated_at" = NOW()
      WHERE "issue_type" = 'INTERNAL';
    `);

    await queryRunner.query(`
      UPDATE "erp_entity_attribute_values"
      SET "value_text" = 'SCRAP', "updated_at" = NOW()
      WHERE "entity_type" = 'GOODS_ISSUE' AND "value_text" = 'INTERNAL';
    `);
  }
}
