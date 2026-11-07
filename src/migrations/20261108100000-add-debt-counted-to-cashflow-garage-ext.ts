import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cờ `debt_counted`: phiếu có được tính vào công nợ phiếu dịch vụ hay không.
 * Phiếu thu trạng thái NULL không có settlement ở bản cũ thì FALSE: vẫn có thể giữ liên kết
 * ngân hàng (phân bổ) nhưng không làm đổi công nợ, đúng như bản cũ.
 * Mặc định TRUE cho mọi phiếu mới. Backfill (--apply) điền giá trị cho phiếu cũ.
 */
export class AddDebtCountedToCashflowGarageExt20261108100000 implements MigrationInterface {
  name = 'AddDebtCountedToCashflowGarageExt20261108100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_garage_forecast_ext"
        ADD COLUMN IF NOT EXISTS "debt_counted" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_garage_forecast_ext"
        DROP COLUMN IF EXISTS "debt_counted"
    `);
  }
}
