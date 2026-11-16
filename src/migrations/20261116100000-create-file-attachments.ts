import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo `file_attachments` (file đính kèm đa owner) và `file_attachment_settings` (một dòng).
 *
 * - Không đụng `erp_attachments`, `erp_invoice_attachments`, `erp_invoices` (V1 chạy song song).
 * - Dòng cài đặt mặc định: tự động dọn TẮT, giữ 30 ngày (chỉ có tác dụng khi bật).
 * - Không cấp quyền mới: resource `attachments` và `invoices` đã có trong ma trận RBAC.
 * - `down()` chỉ xóa hai bảng mới.
 */
export class CreateFileAttachments20261116100000 implements MigrationInterface {
  name = 'CreateFileAttachments20261116100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "owner_type" varchar(64) NOT NULL,
        "owner_id" uuid NOT NULL,
        "category" varchar(32) NOT NULL DEFAULT 'KHAC',
        "is_original" boolean NOT NULL DEFAULT false,
        "file_name" varchar(255) NOT NULL,
        "file_key" varchar(512) NOT NULL,
        "origin" varchar(16) NOT NULL DEFAULT 'V2',
        "legacy_source" varchar(96),
        "file_size" bigint NOT NULL DEFAULT 0,
        "mime_type" varchar(128),
        "checksum_sha256" varchar(64),
        "created_by" uuid,
        "deleted_at" timestamptz,
        "deleted_by" uuid,
        CONSTRAINT "PK_file_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_file_attachments_origin" CHECK ("origin" IN ('V2', 'LEGACY'))
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_file_attachments_is_deleted" ON "file_attachments" ("is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_file_attachments_owner_active" ON "file_attachments" ("owner_type", "owner_id") WHERE "is_deleted" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_file_attachments_deleted" ON "file_attachments" ("is_deleted", "deleted_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_file_attachments_file_key" ON "file_attachments" ("file_key")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_file_attachments_owner_key_active" ON "file_attachments" ("owner_type", "owner_id", "file_key") WHERE "is_deleted" = false`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_attachment_settings" (
        "id" smallint NOT NULL,
        "auto_purge_enabled" boolean NOT NULL DEFAULT false,
        "retention_days" integer NOT NULL DEFAULT 30,
        "updated_by" uuid,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_file_attachment_settings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_file_attachment_settings_singleton" CHECK ("id" = 1),
        CONSTRAINT "CHK_file_attachment_settings_retention" CHECK ("retention_days" >= 1)
      )`);
    await queryRunner.query(
      `INSERT INTO "file_attachment_settings" ("id", "auto_purge_enabled", "retention_days") VALUES (1, false, 30) ON CONFLICT ("id") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "file_attachment_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_attachments"`);
  }
}
