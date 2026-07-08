import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBranchIdFromAccounts1783440211309 implements MigrationInterface {
  name = 'DropBranchIdFromAccounts1783440211309';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" DROP CONSTRAINT "FK_27b149d86247e704b3e385e7767"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_chart_of_accounts" DROP COLUMN "branch_id"`,
    );
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
