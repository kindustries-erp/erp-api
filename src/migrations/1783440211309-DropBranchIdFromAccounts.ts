import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBranchIdFromAccounts1783440211309 implements MigrationInterface {
  name = 'DropBranchIdFromAccounts1783440211309';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const constraints = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'erp_chart_of_accounts' AND constraint_name = 'FK_27b149d86247e704b3e385e7767'
    `);
    if (constraints.length > 0) {
      await queryRunner.query(
        `ALTER TABLE "erp_chart_of_accounts" DROP CONSTRAINT "FK_27b149d86247e704b3e385e7767"`,
      );
    } else {
      console.warn('Ignore missing constraint FK_27b149d86247e704b3e385e7767');
    }
    const columns = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'erp_chart_of_accounts' AND column_name = 'branch_id'
    `);
    if (columns.length > 0) {
      await queryRunner.query(
        `ALTER TABLE "erp_chart_of_accounts" DROP COLUMN "branch_id"`,
      );
    } else {
      console.warn('Ignore missing column branch_id in erp_chart_of_accounts');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" ADD "branch_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" ADD CONSTRAINT "FK_27b149d86247e704b3e385e7767" FOREIGN KEY ("branch_id") REFERENCES "erp_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
