import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashflowClassificationPurposeToBankTransactions20261022100000 implements MigrationInterface {
  name = 'AddCashflowClassificationPurposeToBankTransactions20261022100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "cashflow_classification" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "cashflow_purpose" character varying(50)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_bank_txn_cashflow_classification" ON "erp_bank_transactions" ("cashflow_classification")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_bank_txn_cashflow_purpose" ON "erp_bank_transactions" ("cashflow_purpose")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_bank_txn_cashflow_purpose"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_bank_txn_cashflow_classification"`,
    );

    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "cashflow_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "cashflow_classification"`,
    );
  }
}
