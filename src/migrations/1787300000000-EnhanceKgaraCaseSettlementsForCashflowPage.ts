import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceKgaraCaseSettlementsForCashflowPage1787300000000 implements MigrationInterface {
  name = 'EnhanceKgaraCaseSettlementsForCashflowPage1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_case_settlements"
      ADD COLUMN IF NOT EXISTS "payment_method" character varying(30) NOT NULL DEFAULT 'BANK_TRANSFER',
      ADD COLUMN IF NOT EXISTS "receipt_number" character varying(50),
      ADD COLUMN IF NOT EXISTS "payer_type" character varying(20) NOT NULL DEFAULT 'KH';
    `);

    await queryRunner.query(`
      ALTER TABLE "kgara_case_settlements"
      ALTER COLUMN "case_id" DROP NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_case_settlements_trans_date" 
      ON "kgara_case_settlements" ("trans_date" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_case_settlements_payment_method" 
      ON "kgara_case_settlements" ("payment_method");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_case_settlements_payment_method"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_case_settlements_trans_date"`,
    );
    await queryRunner.query(`
      ALTER TABLE "kgara_case_settlements"
      DROP COLUMN IF EXISTS "payer_type",
      DROP COLUMN IF EXISTS "receipt_number",
      DROP COLUMN IF EXISTS "payment_method";
    `);
  }
}
