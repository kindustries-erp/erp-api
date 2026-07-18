import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentDateToJournalEntry1784206000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ADD COLUMN IF NOT EXISTS "document_date" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" DROP COLUMN "document_date"`,
    );
  }
}
