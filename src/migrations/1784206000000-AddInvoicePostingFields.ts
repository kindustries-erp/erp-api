import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoicePostingFields1784206000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "posting_status" VARCHAR(20) NOT NULL DEFAULT 'UNPOSTED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "posting_date" DATE`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "journal_entry_id" UUID`,
    );
    try {
      await queryRunner.query(
        `ALTER TABLE "erp_invoices" ADD CONSTRAINT "fk_erp_invoices_journal_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "erp_journal_entries"("id") ON DELETE SET NULL`,
      );
    } catch (e) {
      if (e.code !== '42710') throw e; // 42710 is duplicate_object
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT "fk_erp_invoices_journal_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "journal_entry_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "posting_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "posting_status"`,
    );
  }
}
