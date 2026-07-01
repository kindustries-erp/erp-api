import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchIdToErpInvoices1782918174063 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "erp_invoices" ADD "branch_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "branch_id"`,
    );
  }
}
