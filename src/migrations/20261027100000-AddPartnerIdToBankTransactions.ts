import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartnerIdToBankTransactions20261027100000 implements MigrationInterface {
  name = 'AddPartnerIdToBankTransactions20261027100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "partner_id" uuid`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_bank_txn_partner_id'
        ) THEN
          ALTER TABLE "erp_bank_transactions"
            ADD CONSTRAINT "FK_erp_bank_txn_partner_id"
            FOREIGN KEY ("partner_id") REFERENCES "erp_business_partners"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_bank_txn_partner_id" ON "erp_bank_transactions" ("partner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_business_partners_tax_code" ON "erp_business_partners" ("tax_code") WHERE "is_deleted" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_business_partners_tax_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_bank_txn_partner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP CONSTRAINT IF EXISTS "FK_erp_bank_txn_partner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "partner_id"`,
    );
  }
}
