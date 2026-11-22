import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtraDataToLoansTables1794392000000 implements MigrationInterface {
  name = 'AddExtraDataToLoansTables1794392000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loans_finance"
      ADD COLUMN IF NOT EXISTS "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "loans_finance"
        ADD CONSTRAINT "CHK_loans_finance_extra_data_object"
        CHECK (jsonb_typeof("extra_data") = 'object');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "loan_payments_finance"
      ADD COLUMN IF NOT EXISTS "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "loan_payments_finance"
        ADD CONSTRAINT "CHK_loan_payments_finance_extra_data_object"
        CHECK (jsonb_typeof("extra_data") = 'object');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loan_payments_finance"
      DROP CONSTRAINT IF EXISTS "CHK_loan_payments_finance_extra_data_object";
      ALTER TABLE "loan_payments_finance"
      DROP COLUMN IF EXISTS "extra_data";
    `);
    await queryRunner.query(`
      ALTER TABLE "loans_finance"
      DROP CONSTRAINT IF EXISTS "CHK_loans_finance_extra_data_object";
      ALTER TABLE "loans_finance"
      DROP COLUMN IF EXISTS "extra_data";
    `);
  }
}
