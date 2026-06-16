import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierInvoiceNoPo20260616172700 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_purchase_orders
        ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(128) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_purchase_orders
        DROP COLUMN IF EXISTS supplier_invoice_no
    `);
  }
}
