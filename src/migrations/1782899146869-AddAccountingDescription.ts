import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingDescription1782899146869 implements MigrationInterface {
  name = 'AddAccountingDescription1782899146869';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD "accounting_description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ADD "subject_name" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" DROP COLUMN "subject_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN "accounting_description"`,
    );
  }
}
