import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBankTransactionsTables1782577701084 implements MigrationInterface {
  name = 'CreateBankTransactionsTables1782577701084';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "erp_bank_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "bank_code" character varying(50) NOT NULL, "bank_name" character varying(255) NOT NULL, "account_number" character varying(50) NOT NULL, "account_name" character varying(255) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'VND', "is_active" boolean NOT NULL DEFAULT true, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f76c0247f4599eccede63195b35" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_cash_books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'VND', "is_active" boolean NOT NULL DEFAULT true, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_55d8d71ba64435561fef007670d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_bank_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source_type" character varying(10) NOT NULL, "bank_account_id" uuid, "cash_book_id" uuid, "branch_id" uuid NOT NULL, "stt" integer, "trans_date" TIMESTAMP NOT NULL, "efd_date" TIMESTAMP, "reference_number" character varying(100), "debit_amount" numeric(18,4) NOT NULL DEFAULT '0', "credit_amount" numeric(18,4) NOT NULL DEFAULT '0', "balance" numeric(18,4), "seq_no" character varying(100), "description" text, "correspondent_account" character varying(100), "correspondent_name" character varying(255), "correspondent_bank" character varying(255), "is_deleted" boolean NOT NULL DEFAULT false, "import_batch_id" character varying(50), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_298abe74ea5163d5c893405e8e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_bank_account_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bank_account_id" uuid NOT NULL, "period_date" date NOT NULL, "opening_balance" numeric(18,4) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'VND', "note" text, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eaeb98d1e179ed091130440dac0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_cash_book_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cash_book_id" uuid NOT NULL, "period_date" date NOT NULL, "opening_balance" numeric(18,4) NOT NULL DEFAULT '0', "currency" character varying(10) NOT NULL DEFAULT 'VND', "note" text, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a7e429bb4fc1f455c2ee9a839e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_accounts" ADD CONSTRAINT "FK_0c88d5def2737555cb0e99592d2" FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_books" ADD CONSTRAINT "FK_be903f27dced5803a4f70351db3" FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD CONSTRAINT "FK_cce647535e4acef9ecfd58a4262" FOREIGN KEY ("bank_account_id") REFERENCES "erp_bank_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD CONSTRAINT "FK_d3433415de0d13c983a31aca599" FOREIGN KEY ("cash_book_id") REFERENCES "erp_cash_books"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD CONSTRAINT "FK_3eb30f321736f5d2da9ca4f10a3" FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_account_balances" ADD CONSTRAINT "FK_b854e051876e653ec6355c05d14" FOREIGN KEY ("bank_account_id") REFERENCES "erp_bank_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_book_balances" ADD CONSTRAINT "FK_09905a5888e6b377c3693b392da" FOREIGN KEY ("cash_book_id") REFERENCES "erp_cash_books"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_cash_book_balances" DROP CONSTRAINT "FK_09905a5888e6b377c3693b392da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_account_balances" DROP CONSTRAINT "FK_b854e051876e653ec6355c05d14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP CONSTRAINT "FK_3eb30f321736f5d2da9ca4f10a3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP CONSTRAINT "FK_d3433415de0d13c983a31aca599"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP CONSTRAINT "FK_cce647535e4acef9ecfd58a4262"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_books" DROP CONSTRAINT "FK_be903f27dced5803a4f70351db3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_accounts" DROP CONSTRAINT "FK_0c88d5def2737555cb0e99592d2"`,
    );
    await queryRunner.query(`DROP TABLE "erp_cash_book_balances"`);
    await queryRunner.query(`DROP TABLE "erp_bank_account_balances"`);
    await queryRunner.query(`DROP TABLE "erp_bank_transactions"`);
    await queryRunner.query(`DROP TABLE "erp_cash_books"`);
    await queryRunner.query(`DROP TABLE "erp_bank_accounts"`);
  }
}
