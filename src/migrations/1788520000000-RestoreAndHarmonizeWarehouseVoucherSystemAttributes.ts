import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestoreAndHarmonizeWarehouseVoucherSystemAttributes1788520000000 implements MigrationInterface {
  name = 'RestoreAndHarmonizeWarehouseVoucherSystemAttributes1788520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add name_en to erp_bom_categories & erp_bom_attribute_defs
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      ADD COLUMN IF NOT EXISTS "name_en" varchar(255) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      ADD COLUMN IF NOT EXISTS "name_en" varchar(255) NULL;
    `);

    // 2. GOODS_RECEIPT: Ensure default system attribute "type_inventory_receipt" with full bilingual options & restore 'PO'
    const defaultGrOptions = JSON.stringify([
      {
        value: 'PO',
        label: 'Đơn mua hàng (PO)',
        labelEn: 'Purchase Order (PO)',
        labels: { vi: 'Đơn mua hàng (PO)', en: 'Purchase Order (PO)' },
      },
      {
        value: 'PRODUCTION',
        label: 'Nhập sản xuất (MO)',
        labelEn: 'Manufacturing Receipt (MO)',
        labels: {
          vi: 'Nhập sản xuất (MO)',
          en: 'Manufacturing Receipt (MO)',
        },
      },
      {
        value: 'RETURN',
        label: 'Nhập trả hàng',
        labelEn: 'Goods Return Receipt',
        labels: { vi: 'Nhập trả hàng', en: 'Goods Return Receipt' },
      },
      {
        value: 'WARRANTY',
        label: 'Nhập bảo hành',
        labelEn: 'Warranty Receipt',
        labels: { vi: 'Nhập bảo hành', en: 'Warranty Receipt' },
      },
      {
        value: 'OTHER',
        label: 'Nhập khác',
        labelEn: 'Other Receipt',
        labels: { vi: 'Nhập khác', en: 'Other Receipt' },
      },
    ]);

    const existingGrType = await queryRunner.query(`
      SELECT id, code, options FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'GOODS_RECEIPT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type', 'receipt_type', 'type_inventory_receipt')
      LIMIT 1;
    `);

    if (existingGrType && existingGrType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_inventory_receipt',
            "name" = 'Loại nhập kho',
            "name_en" = 'Goods Receipt Type',
            "field_type" = 'SELECT',
            "options" = $1::jsonb
        WHERE "id" = $2;
      `,
        [defaultGrOptions, existingGrType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'GOODS_RECEIPT', 'type_inventory_receipt', 'Loại nhập kho', 'Goods Receipt Type',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultGrOptions],
      );
    }

    // 3. GOODS_ISSUE: Ensure default system attribute "type_inventory_issue" with bilingual options
    const defaultGiOptions = JSON.stringify([
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

    const existingGiType = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'GOODS_ISSUE'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type', 'issue_type', 'type_inventory_issue')
      LIMIT 1;
    `);

    if (existingGiType && existingGiType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_inventory_issue',
            "name" = 'Loại xuất kho',
            "name_en" = 'Goods Issue Type',
            "field_type" = 'SELECT',
            "options" = $1::jsonb
        WHERE "id" = $2;
      `,
        [defaultGiOptions, existingGiType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'GOODS_ISSUE', 'type_inventory_issue', 'Loại xuất kho', 'Goods Issue Type',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultGiOptions],
      );
    }

    // 4. INVENTORY_ADJUSTMENT: Ensure default system attribute "type_inventory_adjustment" with bilingual options
    const defaultIaOptions = JSON.stringify([
      {
        value: 'PERIODIC',
        label: 'Kiểm kê định kỳ',
        labelEn: 'Periodic Inventory Audit',
        labels: {
          vi: 'Kiểm kê định kỳ',
          en: 'Periodic Inventory Audit',
        },
      },
      {
        value: 'DAMAGED',
        label: 'Hàng hỏng hóc / Hao hụt',
        labelEn: 'Damaged & Loss Adjustment',
        labels: {
          vi: 'Hàng hỏng hóc / Hao hụt',
          en: 'Damaged & Loss Adjustment',
        },
      },
      {
        value: 'COUNT_ERROR',
        label: 'Sai lệch kiểm đếm',
        labelEn: 'Count Discrepancy Adjustment',
        labels: {
          vi: 'Sai lệch kiểm đếm',
          en: 'Count Discrepancy Adjustment',
        },
      },
      {
        value: 'RECLASSIFY',
        label: 'Phân loại quy cách',
        labelEn: 'Specification Reclassification',
        labels: {
          vi: 'Phân loại quy cách',
          en: 'Specification Reclassification',
        },
      },
      {
        value: 'OTHER',
        label: 'Lý do khác',
        labelEn: 'Other Reason',
        labels: { vi: 'Lý do khác', en: 'Other Reason' },
      },
    ]);

    const existingIaType = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'INVENTORY_ADJUSTMENT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('reason', 'adjustment_reason', 'type', 'xk', 'type_inventory_adjustment')
      LIMIT 1;
    `);

    if (existingIaType && existingIaType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_inventory_adjustment',
            "name" = 'Lý do điều chỉnh',
            "name_en" = 'Adjustment Reason',
            "field_type" = 'SELECT',
            "options" = $1::jsonb
        WHERE "id" = $2;
      `,
        [defaultIaOptions, existingIaType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'INVENTORY_ADJUSTMENT', 'type_inventory_adjustment', 'Lý do điều chỉnh', 'Adjustment Reason',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultIaOptions],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      DROP COLUMN IF EXISTS "name_en";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      DROP COLUMN IF EXISTS "name_en";
    `);
  }
}
