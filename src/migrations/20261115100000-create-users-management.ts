import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng `users_management` (users v2). Chỉ tạo bảng, không đụng `core_users`.
 * Dữ liệu backfill nằm ở migration riêng. down() chỉ xóa bảng này.
 */
export class CreateUsersManagement20261115100000 implements MigrationInterface {
  name = 'CreateUsersManagement20261115100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users_management" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "employee_id" uuid,
        "legacy_directus_user_id" uuid,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid,
        "password_changed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_users_management_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_management_extra_data_object"
          CHECK (jsonb_typeof("extra_data") = 'object'),
        CONSTRAINT "FK_users_management_employee_id"
          FOREIGN KEY ("employee_id") REFERENCES "erp_employees"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_management_email" ON "users_management" ("email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_management_employee_id" ON "users_management" ("employee_id") WHERE "employee_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_management_is_deleted" ON "users_management" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users_management"`);
  }
}
