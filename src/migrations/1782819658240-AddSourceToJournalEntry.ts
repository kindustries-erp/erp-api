import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceToJournalEntry1782819658240 implements MigrationInterface {
  name = 'AddSourceToJournalEntry1782819658240';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ADD "source_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ADD "source_type" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" DROP COLUMN "source_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" DROP COLUMN "source_id"`,
    );
  }
}
