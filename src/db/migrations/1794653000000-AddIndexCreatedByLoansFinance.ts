import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexCreatedByLoansFinance1794653000000 implements MigrationInterface {
  name = 'AddIndexCreatedByLoansFinance1794653000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loans_finance_created_by" ON "loans_finance" ("created_by");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_loans_finance_created_by";
    `);
  }
}
