import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAccountingDescriptionWithNoteOnBankTransactions20261026100000 implements MigrationInterface {
  name = 'ReplaceAccountingDescriptionWithNoteOnBankTransactions20261026100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "note" text`,
    );
    // Chỉ copy ghi chú nhập tay; bỏ các dòng đã chép nguyên diễn giải ngân hàng
    await queryRunner.query(
      `UPDATE "erp_bank_transactions"
       SET "note" = btrim("accounting_description")
       WHERE coalesce(btrim("accounting_description"), '') <> ''
         AND position(btrim("accounting_description") in coalesce("description", '')) = 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "accounting_description"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "accounting_description" text`,
    );
    await queryRunner.query(
      `UPDATE "erp_bank_transactions" SET "accounting_description" = "note" WHERE "note" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "note"`,
    );
  }
}
