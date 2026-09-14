import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUniversalSystemOperationsAndSerials20260914120000 implements MigrationInterface {
  name = 'CreateUniversalSystemOperationsAndSerials20260914120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng erp_system_operations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_system_operations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "module" varchar(50) NOT NULL,
        "operation_type" varchar(100) NOT NULL,
        "scope_type" varchar(50) NOT NULL DEFAULT 'MODULE',
        "target_id" varchar(255),
        "target_no" varchar(100),
        "user_id" uuid,
        "user_name" varchar(255),
        "status" varchar(50) NOT NULL DEFAULT 'PROCESSING',
        "is_blocking_ui" boolean NOT NULL DEFAULT true,
        "blocked_actions" text[],
        "progress_data" jsonb,
        "metadata" jsonb,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sys_ops_module_status" ON "erp_system_operations" ("module", "status", "expires_at");
      CREATE INDEX IF NOT EXISTS "idx_sys_ops_scope_target" ON "erp_system_operations" ("scope_type", "target_id");
    `);

    // 2. Mở rộng erp_inventory_tracking_serials với system serial tracking fields
    await queryRunner.query(`
      ALTER TABLE "erp_inventory_tracking_serials"
        ADD COLUMN IF NOT EXISTS "system_serial_no" varchar(255),
        ADD COLUMN IF NOT EXISTS "tracking_type" varchar(50) NOT NULL DEFAULT 'USER_DECLARED',
        ADD COLUMN IF NOT EXISTS "unit_cost" numeric(18,3),
        ADD COLUMN IF NOT EXISTS "source_document_type" varchar(50) DEFAULT 'GOODS_RECEIPT',
        ADD COLUMN IF NOT EXISTS "source_document_id" uuid;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inv_tracking_system_serial_no" ON "erp_inventory_tracking_serials" ("system_serial_no");
      CREATE INDEX IF NOT EXISTS "idx_inv_tracking_item_status_fifo" ON "erp_inventory_tracking_serials" ("item_id", "status", "created_at" ASC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_inv_tracking_item_status_fifo";
      DROP INDEX IF EXISTS "idx_inv_tracking_system_serial_no";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_inventory_tracking_serials"
        DROP COLUMN IF EXISTS "source_document_id",
        DROP COLUMN IF EXISTS "source_document_type",
        DROP COLUMN IF EXISTS "unit_cost",
        DROP COLUMN IF EXISTS "tracking_type",
        DROP COLUMN IF EXISTS "system_serial_no";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "erp_system_operations" CASCADE;
    `);
  }
}
