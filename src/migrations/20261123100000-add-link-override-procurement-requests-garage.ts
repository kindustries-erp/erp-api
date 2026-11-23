import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bộ "liên kết FK + sửa cục bộ không đè nguồn" (link-override-core) cho phiếu đề nghị mua garage:
 * - `source_snapshot`: giá trị chi nhánh liên kết do server lập (khóa camelCase, hiện chỉ `branchName`).
 * - `overrides`: tập field đã sửa cục bộ so với chi nhánh (rỗng khi chưa sửa).
 * Backfill snapshot = giá trị hiện có của `branch_name` (chỉ khi có giá trị), nên chưa có field nào bị coi là đã sửa.
 * Dòng chưa có `branch_name` giữ snapshot rỗng; service lập snapshot từ chi nhánh ở lần sửa đầu tiên.
 */
export class AddLinkOverrideProcurementRequestsGarage20261123100000 implements MigrationInterface {
  name = 'AddLinkOverrideProcurementRequestsGarage20261123100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "proc_requests_garage"
        ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "overrides" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      UPDATE "proc_requests_garage"
      SET "source_snapshot" = jsonb_build_object('branchName', "branch_name")
      WHERE "source_snapshot" = '{}'::jsonb AND "branch_name" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "proc_requests_garage"
        DROP COLUMN IF EXISTS "overrides",
        DROP COLUMN IF EXISTS "source_snapshot"
    `);
  }
}
