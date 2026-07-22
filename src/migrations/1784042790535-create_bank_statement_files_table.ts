import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBankStatementFilesTable1784042790535 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "erp_bank_statement_files" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "branch_id" uuid NOT NULL,
                "bank_account_id" uuid,
                "cash_book_id" uuid,
                "period_date" character varying(50),
                "file_id" uuid NOT NULL,
                "note" text,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_erp_bank_statement_files" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_bank_statement_files_branch" ON "erp_bank_statement_files" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_bank_statement_files_bank_account" ON "erp_bank_statement_files" ("bank_account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_erp_bank_statement_files_cash_book" ON "erp_bank_statement_files" ("cash_book_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_erp_bank_statement_files_cash_book"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_erp_bank_statement_files_bank_account"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_erp_bank_statement_files_branch"`);
    await queryRunner.query(`DROP TABLE "erp_bank_statement_files"`);
  }
}
