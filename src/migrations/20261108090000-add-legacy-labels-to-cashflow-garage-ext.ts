import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Giữ nguyên nhãn gốc của phiếu cũ để response cũ đọc lại đúng:
 *  - legacy_created_by: người tạo dạng chữ (email hoặc nhãn hệ thống). Cột created_by của header là UUID nên không chứa được.
 *  - legacy_payment_method: nhãn phương thức gốc (ví dụ "Chuyển khoản", "Thẻ tín dụng").
 * Chỉ thêm cột nullable, không sửa dữ liệu. Dữ liệu được điền bởi backfill (--apply).
 */
export class AddLegacyLabelsToCashflowGarageExt20261108090000 implements MigrationInterface {
  name = 'AddLegacyLabelsToCashflowGarageExt20261108090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_garage_forecast_ext"
        ADD COLUMN IF NOT EXISTS "legacy_created_by" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "legacy_payment_method" varchar(64) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_garage_forecast_ext"
        DROP COLUMN IF EXISTS "legacy_payment_method",
        DROP COLUMN IF EXISTS "legacy_created_by"
    `);
  }
}
