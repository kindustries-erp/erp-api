import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nhật ký chuyển trạng thái duyệt dùng chung cho PR và PO mới.
 * Chỉ ghi thêm. down() chỉ xóa bảng mới tạo.
 */
export class CreateApprovalEvents20261105100000 implements MigrationInterface {
  name = 'CreateApprovalEvents20261105100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_approval_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doc_type" varchar(64) NOT NULL,
        "doc_id" uuid NOT NULL,
        "action" varchar(32) NOT NULL,
        "from_status" varchar(64) NOT NULL,
        "to_status" varchar(64) NOT NULL,
        "actor_id" uuid NOT NULL,
        "actor_roles" text[] NOT NULL DEFAULT '{}',
        "comment" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_approval_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_approval_events_doc" ON "erp_approval_events" ("doc_type", "doc_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_approval_events"`);
  }
}
