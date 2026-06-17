import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingColumnsToErpInvoices20260617221000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_invoices
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS pdf_file_key VARCHAR(512) NULL,
      ADD COLUMN IF NOT EXISTS xml_file_key VARCHAR(512) NULL,
      ADD COLUMN IF NOT EXISTS xml_import_id UUID NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_invoices
      DROP COLUMN IF EXISTS is_deleted,
      DROP COLUMN IF EXISTS pdf_file_key,
      DROP COLUMN IF EXISTS xml_file_key,
      DROP COLUMN IF EXISTS xml_import_id
    `);
  }
}
