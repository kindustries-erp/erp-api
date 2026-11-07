import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trường chi tiết của đề nghị mua (PR) Garage còn thiếu trên dự chi cashflow-core:
 * mã hàng/mô tả/ghi chú của dòng, tiêu đề và người yêu cầu của đề nghị.
 * Cần để facade PR trên dự chi trả đủ dữ liệu cho PO draft (mã hàng) và màn hình chi tiết.
 * Cột mới nullable, không đổi dữ liệu cũ. Backfill chép giá trị từ bảng PR cũ.
 */
export class AddPrDetailFieldsToCashflowCore20261108140000 implements MigrationInterface {
  name = 'AddPrDetailFieldsToCashflowCore20261108140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_forecast_lines"
        ADD COLUMN IF NOT EXISTS "item_id" uuid NULL,
        ADD COLUMN IF NOT EXISTS "item_code" varchar(128) NULL,
        ADD COLUMN IF NOT EXISTS "description" text NULL,
        ADD COLUMN IF NOT EXISTS "notes" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_forecasts"
        ADD COLUMN IF NOT EXISTS "title" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "requester_employee_id" uuid NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dữ liệu các cột này lấy lại được từ bảng PR cũ, nên bỏ cột không mất dữ liệu gốc.
    await queryRunner.query(`
      ALTER TABLE "cashflow_forecasts"
        DROP COLUMN IF EXISTS "requester_employee_id",
        DROP COLUMN IF EXISTS "title"
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_forecast_lines"
        DROP COLUMN IF EXISTS "notes",
        DROP COLUMN IF EXISTS "description",
        DROP COLUMN IF EXISTS "item_code",
        DROP COLUMN IF EXISTS "item_id"
    `);
  }
}
