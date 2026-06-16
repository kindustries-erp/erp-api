import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddR2FieldsToErpInvoices20260616173000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_invoices
        ADD COLUMN IF NOT EXISTS pdf_file_key  VARCHAR(512) NULL,
        ADD COLUMN IF NOT EXISTS xml_file_key  VARCHAR(512) NULL,
        ADD COLUMN IF NOT EXISTS xml_import_id UUID         NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_erp_invoices_xml_import
        ON erp_invoices(xml_import_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_erp_invoices_xml_import`);
    await queryRunner.query(`
      ALTER TABLE erp_invoices
        DROP COLUMN IF EXISTS pdf_file_key,
        DROP COLUMN IF EXISTS xml_file_key,
        DROP COLUMN IF EXISTS xml_import_id
    `);
  }
}
