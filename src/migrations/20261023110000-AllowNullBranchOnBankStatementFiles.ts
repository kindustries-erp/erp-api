import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowNullBranchOnBankStatementFiles20261023110000 implements MigrationInterface {
  name = 'AllowNullBranchOnBankStatementFiles20261023110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Import sao kê không chọn chi nhánh thì file không có chi nhánh
    await queryRunner.query(
      `ALTER TABLE "erp_bank_statement_files" ALTER COLUMN "branch_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const nullRows: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM "erp_bank_statement_files" WHERE "branch_id" IS NULL`,
    );
    if (Number(nullRows[0]?.count ?? 0) > 0) {
      throw new Error(
        'Không thể rollback: còn file sao kê chưa có chi nhánh (branch_id IS NULL). Hãy gán chi nhánh trước.',
      );
    }
    await queryRunner.query(
      `ALTER TABLE "erp_bank_statement_files" ALTER COLUMN "branch_id" SET NOT NULL`,
    );
  }
}
