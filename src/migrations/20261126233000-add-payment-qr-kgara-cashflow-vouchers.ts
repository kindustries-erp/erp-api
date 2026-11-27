import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lưu thông tin thanh toán dựng VietQR cho phiếu thu chi garage (KINDU-2096).
 * Cột đều nullable, không backfill; số tiền QR lấy theo `amount` của phiếu nên không có cột riêng.
 */
export class AddPaymentQrKgaraCashflowVouchers20261126233000 implements MigrationInterface {
  name = 'AddPaymentQrKgaraCashflowVouchers20261126233000';

  private static readonly COLUMNS: ReadonlyArray<[string, string]> = [
    ['qr_company_account_id', 'uuid'],
    ['qr_bank_bin', 'varchar(10)'],
    ['qr_bank_code', 'varchar(50)'],
    ['qr_account_number', 'varchar(50)'],
    ['qr_account_name', 'varchar(255)'],
    ['qr_transfer_content', 'varchar(255)'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [
      col,
      type,
    ] of AddPaymentQrKgaraCashflowVouchers20261126233000.COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "${col}" ${type}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [
      col,
    ] of AddPaymentQrKgaraCashflowVouchers20261126233000.COLUMNS) {
      await queryRunner.query(
        `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
