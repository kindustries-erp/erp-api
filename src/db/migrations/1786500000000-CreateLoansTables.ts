import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoansTables1786500000000 implements MigrationInterface {
  name = 'CreateLoansTables1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename existing legacy tables if any, else create loans_finance
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loans') 
           AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loans_finance') THEN
          ALTER TABLE "loans" RENAME TO "loans_finance";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loans_finance" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loan_code" character varying(50) NOT NULL,
        "title" character varying(255) NOT NULL,
        "lender_name" character varying(255) NOT NULL,
        "partner_id" uuid,
        "principal_amount" numeric(15,2) NOT NULL,
        "annual_interest_rate" numeric(5,2) NOT NULL,
        "tenor_months" integer NOT NULL,
        "amortization_method" character varying(50) NOT NULL,
        "start_date" date NOT NULL,
        "first_payment_date" date NOT NULL,
        "total_paid_principal" numeric(15,2) NOT NULL DEFAULT 0,
        "total_paid_interest" numeric(15,2) NOT NULL DEFAULT 0,
        "remaining_principal" numeric(15,2) NOT NULL,
        "status" character varying(30) NOT NULL DEFAULT 'ACTIVE',
        "notes" text,
        "created_by" character varying(100),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loans_finance_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_loans_finance_loan_code" UNIQUE ("loan_code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loans_finance_status" ON "loans_finance" ("status");
      CREATE INDEX IF NOT EXISTS "IDX_loans_finance_is_deleted" ON "loans_finance" ("is_deleted");
      CREATE INDEX IF NOT EXISTS "IDX_loans_finance_start_date" ON "loans_finance" ("start_date");
      CREATE INDEX IF NOT EXISTS "IDX_loans_finance_partner_id" ON "loans_finance" ("partner_id");
    `);

    // 2. Rename existing legacy loan_payments table if any, else create loan_payments_finance
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_payments') 
           AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_payments_finance') THEN
          ALTER TABLE "loan_payments" RENAME TO "loan_payments_finance";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loan_payments_finance" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loan_id" uuid NOT NULL,
        "period_number" integer NOT NULL,
        "payment_date" date NOT NULL,
        "principal_paid" numeric(15,2) NOT NULL DEFAULT 0,
        "interest_paid" numeric(15,2) NOT NULL DEFAULT 0,
        "total_paid" numeric(15,2) NOT NULL,
        "payment_ref" character varying(100),
        "notes" text,
        "created_by" character varying(100),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loan_payments_finance_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loan_payments_finance_loan_id" ON "loan_payments_finance" ("loan_id");
      CREATE INDEX IF NOT EXISTS "IDX_loan_payments_finance_payment_date" ON "loan_payments_finance" ("payment_date");
      CREATE INDEX IF NOT EXISTS "IDX_loan_payments_finance_is_deleted" ON "loan_payments_finance" ("is_deleted");
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "loan_payments_finance"
        ADD CONSTRAINT "FK_loan_payments_finance_loan_id"
        FOREIGN KEY ("loan_id") REFERENCES "loans_finance"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "loan_payments_finance" DROP CONSTRAINT IF EXISTS "FK_loan_payments_finance_loan_id";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "loan_payments_finance";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loans_finance";`);
  }
}
