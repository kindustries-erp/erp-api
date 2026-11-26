import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đánh dấu xe nhân viên xưởng đưa vào bảng tiến độ (`cases_garage`).
 * - `workshop_tracked_at`: NULL là không có trên bảng. Không backfill: bảng bắt đầu rỗng,
 *   xe KGara chiếu sang không tự lên bảng.
 * - `workshop_tracked_by`: `users.id` trỏ mềm (không FK).
 * - Index phần theo chi nhánh cho query board.
 * Chỉ thêm cột nullable; down() drop index và cột.
 */
export class AddWorkshopTrackingToCasesGarage20261124110000 implements MigrationInterface {
  name = 'AddWorkshopTrackingToCasesGarage20261124110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases_garage"
        ADD COLUMN IF NOT EXISTS "workshop_tracked_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "workshop_tracked_by" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_garage_workshop_tracked"
        ON "cases_garage" ("branch_external_id", "workshop_tracked_at")
        WHERE "workshop_tracked_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cases_garage_workshop_tracked"`,
    );
    await queryRunner.query(`
      ALTER TABLE "cases_garage"
        DROP COLUMN IF EXISTS "workshop_tracked_by",
        DROP COLUMN IF EXISTS "workshop_tracked_at"
    `);
  }
}
