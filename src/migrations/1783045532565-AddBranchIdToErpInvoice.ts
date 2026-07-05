import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchIdToErpInvoice1783045532565 implements MigrationInterface {
  name = 'AddBranchIdToErpInvoice1783045532565';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "erp_invoices" ADD "branch_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "branch_id"`,
    );
  }
}
