import { MigrationInterface, QueryRunner } from 'typeorm';

const GARAGE_TABLES = [
  'debts_garage',
  'debt_allocations_garage',
  'cashflow_vouchers_garage',
] as const;

/**
 * Nền tảng nối chi nhánh garage với chi nhánh hệ thống: bảng liên kết nguồn ngoài
 * (Kgara: `external_id` + `account_key`) và cột `branch_id` nullable + FK ở 3 bảng v2 garage.
 * `branch_external_id` giữ nguyên NOT NULL; chưa đổi logic lọc/ghi.
 */
export class CreateBranchesManagementExternalLinks20261118100100 implements MigrationInterface {
  name = 'CreateBranchesManagementExternalLinks20261118100100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "branches_management_external_links" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "extra_data" jsonb NOT NULL DEFAULT '{}',
         "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
         "is_deleted" boolean NOT NULL DEFAULT false,
         "branch_id" uuid NOT NULL,
         "source" character varying(50) NOT NULL,
         "external_id" character varying(100) NOT NULL,
         "account_key" character varying(50) NOT NULL DEFAULT '',
         CONSTRAINT "PK_branches_management_external_links_id" PRIMARY KEY ("id"),
         CONSTRAINT "CHK_branches_management_external_links_extra_data_object" CHECK (jsonb_typeof("extra_data") = 'object'),
         CONSTRAINT "FK_branches_management_external_links_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches_management"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_management_external_links_is_deleted" ON "branches_management_external_links" ("is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_management_external_links_branch_id" ON "branches_management_external_links" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branches_management_external_links_active" ON "branches_management_external_links" ("source", "external_id", "account_key") WHERE "is_deleted" = false`,
    );
    for (const table of GARAGE_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "branch_id" uuid NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches_management"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_branch_id" ON "${table}" ("branch_id")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...GARAGE_TABLES].reverse()) {
      await queryRunner.query(`DROP INDEX "IDX_${table}_branch_id"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_branch_id"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "branch_id"`);
    }
    await queryRunner.query(`DROP TABLE "branches_management_external_links"`);
  }
}
