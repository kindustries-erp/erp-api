import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng nhân viên v2 `employees_management` (không backfill từ `erp_employees`, bảng v1 giữ nguyên).
 * Cột theo base-core: `id`, `extra_data` (CHECK object), `created_at`/`updated_at` timestamptz, `is_deleted`.
 * Cột riêng: mã, họ tên, liên hệ, trạng thái, `user_id`, ngày (sinh, vào làm, nghỉ việc, timestamptz),
 * chức danh, phòng ban, `branch_id` (FK `erp_branches`), CCCD `national_id`.
 *
 * Nối users: `users_management.employee_id` đang trỏ `erp_employees`. Vì bảng mới rỗng, các liên kết cũ
 * không còn đích, nên được lưu vào `employees_management_legacy_user_links` rồi đặt NULL, sau đó FK
 * chuyển sang `employees_management`. `down()` khôi phục liên kết từ bảng lưu và trả FK về `erp_employees`.
 */
export class CreateEmployeesManagement20261115130000 implements MigrationInterface {
  name = 'CreateEmployeesManagement20261115130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "employees_management" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "employee_code" varchar(255) NOT NULL,
        "full_name" varchar(255) NOT NULL,
        "email" varchar(255),
        "phone" varchar(255),
        "status" varchar(50) NOT NULL DEFAULT 'ACTIVE',
        "user_id" uuid,
        "address" text,
        "notes" text,
        "birth_date" timestamptz,
        "start_date" timestamptz,
        "leave_date" timestamptz,
        "job_title" varchar(255),
        "department" varchar(255),
        "branch_id" uuid,
        "national_id" varchar(20),
        CONSTRAINT "PK_employees_management" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_employees_management_extra_data_object"
          CHECK (jsonb_typeof("extra_data") = 'object')
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_management_is_deleted" ON "employees_management" ("is_deleted")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_employees_management_code_active" ON "employees_management" ("employee_code") WHERE "is_deleted" = false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_employees_management_user_id" ON "employees_management" ("user_id") WHERE "user_id" IS NOT NULL AND "is_deleted" = false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_employees_management_national_id_active" ON "employees_management" ("national_id") WHERE "national_id" IS NOT NULL AND "is_deleted" = false`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees_management" ADD CONSTRAINT "FK_employees_management_branch_id"
       FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Lưu liên kết cũ để down() khôi phục, rồi gỡ khỏi users_management
    await queryRunner.query(`
      CREATE TABLE "employees_management_legacy_user_links" AS
      SELECT "id" AS "user_id", "employee_id"
      FROM "users_management" WHERE "employee_id" IS NOT NULL`);
    await queryRunner.query(
      `UPDATE "users_management" SET "employee_id" = NULL WHERE "employee_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_management" DROP CONSTRAINT IF EXISTS "FK_users_management_employee_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_management" ADD CONSTRAINT "FK_users_management_employee_id"
       FOREIGN KEY ("employee_id") REFERENCES "employees_management"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users_management" DROP CONSTRAINT IF EXISTS "FK_users_management_employee_id"`,
    );
    await queryRunner.query(
      `UPDATE "users_management" SET "employee_id" = NULL WHERE "employee_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_management" ADD CONSTRAINT "FK_users_management_employee_id"
       FOREIGN KEY ("employee_id") REFERENCES "erp_employees"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`
      UPDATE "users_management" u SET "employee_id" = l."employee_id"
      FROM "employees_management_legacy_user_links" l
      WHERE u."id" = l."user_id"
        AND EXISTS (SELECT 1 FROM "erp_employees" e WHERE e."id" = l."employee_id")`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employees_management_legacy_user_links"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employees_management"`);
  }
}
