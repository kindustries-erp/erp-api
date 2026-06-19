import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentDocumentNosToErpInvoices20260619093000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "payment_document_nos" varchar(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "payment_document_nos"`,
    );
  }
}
