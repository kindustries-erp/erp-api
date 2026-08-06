import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Tạo bảng hỗ trợ tính năng As-Built BOM
 *
 * Bảng 1: erp_production_order_serial_assignments
 *   - Lưu mối quan hệ Serial linh kiện → Xe thành phẩm
 *   - serial_id UNIQUE: 1 serial chỉ được gán vào 1 xe
 *
 * Bảng 2: erp_production_checkpoints
 *   - Danh mục trạm lắp ráp trong dây chuyền (dùng giai đoạn 2)
 */
export class CreateAsBuiltBomTables20260803170000 implements MigrationInterface {
  name = 'CreateAsBuiltBomTables20260803170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Bảng 1: erp_production_checkpoints (tạo trước vì được FK tham chiếu) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_production_checkpoints" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "code"       VARCHAR(100) NOT NULL,
        "name"       VARCHAR(255) NOT NULL,
        "sort_order" INT          NOT NULL DEFAULT 0,
        "is_active"  BOOLEAN      NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_production_checkpoints" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_production_checkpoints_code" UNIQUE ("code")
      )
    `);

    // --- Bảng 2: erp_production_order_serial_assignments ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_production_order_serial_assignments" (
        "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
        "production_order_id" UUID        NOT NULL,
        "vehicle_id"          UUID        NOT NULL,
        "bom_line_id"         UUID            NULL,
        "serial_id"           UUID        NOT NULL,
        "assigned_at"         TIMESTAMPTZ NOT NULL,
        "assignment_source"   VARCHAR(50) NOT NULL DEFAULT 'AUTO_FIFO',
        "checkpoint_id"       UUID            NULL,
        "worker_id"           UUID            NULL,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_po_serial_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_po_serial_assignments_serial" UNIQUE ("serial_id")
      )
    `);

    // Indexes cho performance
    await queryRunner.query(`
      CREATE INDEX "idx_po_serial_asgn_production_order"
        ON "erp_production_order_serial_assignments" ("production_order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_po_serial_asgn_vehicle"
        ON "erp_production_order_serial_assignments" ("vehicle_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_production_order_serial_assignments"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_production_checkpoints"`,
    );
  }
}
