import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoaExtraCols20260617090000 implements MigrationInterface {
  name = 'AddCoaExtraCols20260617090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_chart_of_accounts
        ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES erp_chart_of_accounts(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS is_cash_account boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_receivable_account boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_payable_account boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS description text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_chart_of_accounts
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS is_payable_account,
        DROP COLUMN IF EXISTS is_receivable_account,
        DROP COLUMN IF EXISTS is_cash_account,
        DROP COLUMN IF EXISTS level,
        DROP COLUMN IF EXISTS parent_account_id
    `);
  }
}
