import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKgaraCaseSettlements1787100000000 implements MigrationInterface {
  name = 'AddKgaraCaseSettlements1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kgara_case_settlements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "case_id" uuid NOT NULL,
        "gross_profit_id" uuid,
        "bank_transaction_id" uuid,
        "settlement_type" character varying(20) NOT NULL,
        "source_channel" character varying(30) NOT NULL DEFAULT 'ON_SYSTEM',
        "category" character varying(100),
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "trans_date" date,
        "partner_name" character varying(255),
        "note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kgara_case_settlements_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_kgara_case_settlements_case" FOREIGN KEY ("case_id") REFERENCES "kgara_cases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_kgara_case_settlements_gross_profit" FOREIGN KEY ("gross_profit_id") REFERENCES "kgara_gross_profit"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_kgara_case_settlements_bank_txn" FOREIGN KEY ("bank_transaction_id") REFERENCES "erp_bank_transactions"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_case_bank_txn" 
      ON "kgara_case_settlements" ("case_id", "bank_transaction_id") 
      WHERE "bank_transaction_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_case_settlements_case_id" 
      ON "kgara_case_settlements" ("case_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_case_settlements_case_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_case_bank_txn"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kgara_case_settlements"`);
  }
}
