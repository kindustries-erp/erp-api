import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceToJournalEntry1782820000000 implements MigrationInterface {
  name = 'AddReferenceToJournalEntry1782820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ADD "reference" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" DROP COLUMN "reference"`,
    );
  }
}
