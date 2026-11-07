import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dấu đóng đề nghị mua (PR) garage.
 * PR bị Đóng thủ công mà chưa mua hết: dự chi chuyển CANCELLED (không còn tính vào dự báo chi),
 * và ext lưu dấu đóng để giao diện vẫn hiện trạng thái "Đã đóng".
 * Bản cũ không lưu người đóng, nên closed_by để trống cho dữ liệu cũ.
 */
export class AddCloseFieldsToCashflowGarageExt20261108120000 implements MigrationInterface {
  name = 'AddCloseFieldsToCashflowGarageExt20261108120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_garage_forecast_ext"
        ADD COLUMN IF NOT EXISTS "closed_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "closed_by" uuid NULL,
        ADD COLUMN IF NOT EXISTS "close_reason" text NULL
    `);

    // Dự chi PR đã đóng ở bản cũ: CLOSED (cũ) -> CANCELLED + dấu đóng.
    await queryRunner.query(`
      UPDATE "cashflow_forecasts" f
         SET "status" = 'CANCELLED', "updated_at" = now()
        FROM "erp_garage_proc_requests" r
       WHERE r.id = f.id
         AND f.source_type = 'LEGACY_PR'
         AND r.status = 'CLOSED'
         AND f.status <> 'CANCELLED'
    `);
    await queryRunner.query(`
      UPDATE "cashflow_garage_forecast_ext" e
         SET "closed_at" = r."closed_at",
             "close_reason" = r."close_reason"
        FROM "erp_garage_proc_requests" r
        JOIN "cashflow_forecasts" f ON f.id = r.id AND f.source_type = 'LEGACY_PR'
       WHERE e.forecast_id = r.id
         AND r.status = 'CLOSED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trả về SETTLED (trạng thái cũ của PR đã đóng) trước khi bỏ cột.
    await queryRunner.query(`
      UPDATE "cashflow_forecasts" f
         SET "status" = 'SETTLED', "updated_at" = now()
        FROM "cashflow_garage_forecast_ext" e
       WHERE e.forecast_id = f.id
         AND f.source_type = 'LEGACY_PR'
         AND f.status = 'CANCELLED'
         AND e.closed_at IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_garage_forecast_ext"
        DROP COLUMN IF EXISTS "close_reason",
        DROP COLUMN IF EXISTS "closed_by",
        DROP COLUMN IF EXISTS "closed_at"
    `);
  }
}
