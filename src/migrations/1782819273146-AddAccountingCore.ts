import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingCore1782819273146 implements MigrationInterface {
  name = 'AddAccountingCore1782819273146';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" DROP CONSTRAINT "FK_erp_invoice_voucher_netoff_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" DROP CONSTRAINT "FK_erp_invoice_voucher_netoff_bank_transaction"`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_chart_of_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "account_code" character varying(50) NOT NULL, "account_name" character varying(255) NOT NULL, "account_type" character varying(50) NOT NULL, "parent_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7299110eb04a2bc09b6c7ef5a06" UNIQUE ("account_code"), CONSTRAINT "PK_d8bb0d159f5d65cd29147281f33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_journal_entry_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "journal_entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "debit" numeric(18,4) NOT NULL DEFAULT '0', "credit" numeric(18,4) NOT NULL DEFAULT '0', "description" text, "sort" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7ce1f7dd3e5b4f0397f0df7e268" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "entry_no" character varying(100) NOT NULL, "date" TIMESTAMP NOT NULL, "description" text, "status" character varying(50) NOT NULL DEFAULT 'POSTED', "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_792067297b91055865642f86f2a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_accounts" ADD "accounting_account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_books" ADD "accounting_account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" ADD CONSTRAINT "FK_27b149d86247e704b3e385e7767" FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" ADD CONSTRAINT "FK_86c56c14e217b01bfb0e618ec14" FOREIGN KEY ("parent_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_accounts" ADD CONSTRAINT "FK_6145268a8b37c15682c5a49d597" FOREIGN KEY ("accounting_account_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_books" ADD CONSTRAINT "FK_1e9b8699d7bc676f9512891799f" FOREIGN KEY ("accounting_account_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" ADD CONSTRAINT "FK_9927d184b3bee5d3ea2bc8ca010" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" ADD CONSTRAINT "FK_b96c24c9db2cf6240f85425c5f3" FOREIGN KEY ("bank_transaction_id") REFERENCES "erp_bank_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entry_lines" ADD CONSTRAINT "FK_bfb000a988286419559ec6c6aca" FOREIGN KEY ("journal_entry_id") REFERENCES "erp_journal_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entry_lines" ADD CONSTRAINT "FK_1015c140cb119e97668ce30bf0e" FOREIGN KEY ("account_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ADD CONSTRAINT "FK_24b3c7c38774853d0985fe8614b" FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" DROP CONSTRAINT "FK_24b3c7c38774853d0985fe8614b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entry_lines" DROP CONSTRAINT "FK_1015c140cb119e97668ce30bf0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entry_lines" DROP CONSTRAINT "FK_bfb000a988286419559ec6c6aca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" DROP CONSTRAINT "FK_b96c24c9db2cf6240f85425c5f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" DROP CONSTRAINT "FK_9927d184b3bee5d3ea2bc8ca010"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_books" DROP CONSTRAINT "FK_1e9b8699d7bc676f9512891799f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_accounts" DROP CONSTRAINT "FK_6145268a8b37c15682c5a49d597"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" DROP CONSTRAINT "FK_86c56c14e217b01bfb0e618ec14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" DROP CONSTRAINT "FK_27b149d86247e704b3e385e7767"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_cash_books" DROP COLUMN "accounting_account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_accounts" DROP COLUMN "accounting_account_id"`,
    );
    await queryRunner.query(`DROP TABLE "erp_journal_entries"`);
    await queryRunner.query(`DROP TABLE "erp_journal_entry_lines"`);
    await queryRunner.query(`DROP TABLE "erp_chart_of_accounts"`);
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" ADD CONSTRAINT "FK_erp_invoice_voucher_netoff_bank_transaction" FOREIGN KEY ("bank_transaction_id") REFERENCES "erp_bank_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" ADD CONSTRAINT "FK_erp_invoice_voucher_netoff_invoice" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
