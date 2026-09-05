import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsSystemAndSeedDefaultVoucherAttributes1788500000000 implements MigrationInterface {
  name = 'AddIsSystemAndSeedDefaultVoucherAttributes1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add is_system column to erp_bom_attribute_defs
    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false;
    `);

    // 2. GOODS_RECEIPT: Ensure default system attribute "type_inventory_receipt"
    const existingGrType = await queryRunner.query(`
      SELECT id, code, options FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'GOODS_RECEIPT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type', 'receipt_type', 'type_inventory_receipt')
      LIMIT 1;
    `);

    const defaultGrOptions = JSON.stringify([
      { value: 'PO', label: 'Đơn mua hàng (PO)' },
      { value: 'PRODUCTION', label: 'Nhập sản xuất' },
      { value: 'RETURN', label: 'Nhập trả hàng' },
      { value: 'WARRANTY', label: 'Nhập bảo hành' },
      { value: 'OTHER', label: 'Nhập khác' },
    ]);

    if (existingGrType && existingGrType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_inventory_receipt',
            "name" = 'Loại nhập kho',
            "field_type" = 'SELECT',
            "options" = COALESCE("options", $1::jsonb)
        WHERE "id" = $2;
      `,
        [defaultGrOptions, existingGrType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", 
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'GOODS_RECEIPT', 'type_inventory_receipt', 'Loại nhập kho',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultGrOptions],
      );
    }

    // 3. GOODS_ISSUE: Ensure default system attribute "type_inventory_issue"
    const existingGiType = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'GOODS_ISSUE'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type', 'issue_type', 'type_inventory_issue')
      LIMIT 1;
    `);

    const defaultGiOptions = JSON.stringify([
      { value: 'SALE', label: 'Xuất bán hàng (SO)' },
      { value: 'PRODUCTION', label: 'Xuất sản xuất (NVL)' },
      { value: 'WARRANTY', label: 'Xuất bảo hành' },
      { value: 'SCRAP', label: 'Xuất hủy / Hao hụt' },
      { value: 'OTHER', label: 'Xuất khác' },
    ]);

    if (existingGiType && existingGiType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_inventory_issue',
            "name" = 'Loại xuất kho',
            "field_type" = 'SELECT',
            "options" = COALESCE("options", $1::jsonb)
        WHERE "id" = $2;
      `,
        [defaultGiOptions, existingGiType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", 
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'GOODS_ISSUE', 'type_inventory_issue', 'Loại xuất kho',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultGiOptions],
      );
    }

    // 4. INVENTORY_ADJUSTMENT: Ensure default system attribute "type_inventory_adjustment"
    const existingIaType = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'INVENTORY_ADJUSTMENT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('reason', 'adjustment_reason', 'type', 'xk', 'type_inventory_adjustment')
      LIMIT 1;
    `);

    const defaultIaOptions = JSON.stringify([
      { value: 'PERIODIC', label: 'Kiểm kê định kỳ' },
      { value: 'DAMAGED', label: 'Hàng hỏng hóc / Hao hụt' },
      { value: 'COUNT_ERROR', label: 'Sai lệch kiểm đếm' },
      { value: 'RECLASSIFY', label: 'Phân loại quy cách' },
      { value: 'OTHER', label: 'Lý do khác' },
    ]);

    if (existingIaType && existingIaType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_inventory_adjustment',
            "name" = 'Lý do điều chỉnh',
            "field_type" = 'SELECT',
            "options" = COALESCE("options", $1::jsonb)
        WHERE "id" = $2;
      `,
        [defaultIaOptions, existingIaType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", 
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'INVENTORY_ADJUSTMENT', 'type_inventory_adjustment', 'Lý do điều chỉnh',
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
      DROP COLUMN IF EXISTS "is_system";
    `);
  }
}
