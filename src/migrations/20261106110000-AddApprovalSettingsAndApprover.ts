import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Khóa bật/tắt duyệt theo họ chứng từ (erp_approval_settings) và cột approver_id
 * trên 4 bảng header PR/PO (họ thường + garage). Cột nullable, không đổi dữ liệu cũ.
 * Seed khóa cho hai module garage, mặc định bật (giữ hành vi hiện tại).
 */
export class AddApprovalSettingsAndApprover20261106110000 implements MigrationInterface {
  name = 'AddApprovalSettingsAndApprover20261106110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_approval_settings" (
        "doc_type" varchar(64) NOT NULL,
        "approval_enabled" boolean NOT NULL DEFAULT true,
        "updated_by" uuid NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_approval_settings" PRIMARY KEY ("doc_type")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "erp_approval_settings" ("doc_type", "approval_enabled")
      VALUES ('GARAGE_PROCUREMENT_REQUEST', true), ('GARAGE_PROCUREMENT_ORDER', true)
      ON CONFLICT ("doc_type") DO NOTHING
    `);

    const headers = [
      'erp_proc_requests',
      'erp_proc_orders',
      'erp_garage_proc_requests',
      'erp_garage_proc_orders',
    ];
    for (const table of headers) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "approver_id" uuid NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_approver_id" ON "${table}" ("approver_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const headers = [
      'erp_garage_proc_orders',
      'erp_garage_proc_requests',
      'erp_proc_orders',
      'erp_proc_requests',
    ];
    for (const table of headers) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_${table}_approver_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "approver_id"`,
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_approval_settings"`);
  }
}
