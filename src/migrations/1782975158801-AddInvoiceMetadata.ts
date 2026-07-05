import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceMetadata1782975158801 implements MigrationInterface {
  name = 'AddInvoiceMetadata1782975158801';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "license_plate" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "settlement_order" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "settlement_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "license_plate"`,
    );
  }
}
