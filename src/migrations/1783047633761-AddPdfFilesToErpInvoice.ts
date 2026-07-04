import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPdfFilesToErpInvoice1783047633761 implements MigrationInterface {
  name = 'AddPdfFilesToErpInvoice1783047633761';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "erp_invoices" ADD "pdf_files" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "pdf_files"`,
    );
  }
}
