import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWarehouseVoucherSystemAttributeCodes1788510000000 implements MigrationInterface {
  name = 'UpdateWarehouseVoucherSystemAttributeCodes1788510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. GOODS_RECEIPT: Ensure code is 'type_inventory_receipt'
    await queryRunner.query(`
      UPDATE "erp_bom_attribute_defs"
      SET "code" = 'type_inventory_receipt',
          "is_system" = true
      WHERE "module_key_global" = 'GOODS_RECEIPT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type', 'receipt_type', 'type_inventory_receipt');
    `);

    // 2. GOODS_ISSUE: Ensure code is 'type_inventory_issue'
    await queryRunner.query(`
      UPDATE "erp_bom_attribute_defs"
      SET "code" = 'type_inventory_issue',
          "is_system" = true
      WHERE "module_key_global" = 'GOODS_ISSUE'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type', 'issue_type', 'type_inventory_issue');
    `);

    // 3. INVENTORY_ADJUSTMENT: Ensure code is 'type_inventory_adjustment'
    await queryRunner.query(`
      UPDATE "erp_bom_attribute_defs"
      SET "code" = 'type_inventory_adjustment',
          "is_system" = true
      WHERE "module_key_global" = 'INVENTORY_ADJUSTMENT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('reason', 'adjustment_reason', 'type', 'xk', 'type_inventory_adjustment');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op rollback
  }
}
