import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchIdsAndNullableBranchForInvoicesAndBankTxns20261023100000 implements MigrationInterface {
  name = 'AddBranchIdsAndNullableBranchForInvoicesAndBankTxns20261023100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "branch_ids" uuid[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "branch_ids" uuid[] NOT NULL DEFAULT '{}'`,
    );

    // Backfill: chi nhánh đơn cũ trở thành phần tử đầu của mảng
    await queryRunner.query(
      `UPDATE "erp_invoices" SET "branch_ids" = ARRAY["branch_id"] WHERE "branch_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "erp_bank_transactions" SET "branch_ids" = ARRAY["branch_id"] WHERE "branch_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_invoices_branch_ids" ON "erp_invoices" USING GIN ("branch_ids")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_bank_txn_branch_ids" ON "erp_bank_transactions" USING GIN ("branch_ids")`,
    );

    // Cho phép không có chi nhánh (sao kê, bút toán) — gán sau bằng branch_ids
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ALTER COLUMN "branch_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ALTER COLUMN "branch_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const nullRows: Array<{ count: string }> = await queryRunner.query(
      `SELECT (
         (SELECT COUNT(*) FROM "erp_bank_transactions" WHERE "branch_id" IS NULL) +
         (SELECT COUNT(*) FROM "erp_journal_entries" WHERE "branch_id" IS NULL)
       )::text AS count`,
    );
    if (Number(nullRows[0]?.count ?? 0) > 0) {
      throw new Error(
        'Không thể rollback: còn giao dịch/bút toán chưa có chi nhánh (branch_id IS NULL). Hãy gán chi nhánh trước.',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "erp_journal_entries" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" ALTER COLUMN "branch_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_bank_txn_branch_ids"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_invoices_branch_ids"`,
    );

    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "branch_ids"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "branch_ids"`,
    );
  }
}
