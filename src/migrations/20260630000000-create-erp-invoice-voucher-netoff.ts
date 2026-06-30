import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateErpInvoiceVoucherNetoff20260630000000 implements MigrationInterface {
  name = 'CreateErpInvoiceVoucherNetoff20260630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "erp_invoice_voucher_netoff" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoice_id" uuid NOT NULL,
        "bank_transaction_id" uuid NOT NULL,
        "net_off_amount" numeric(18,2) NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_invoice_voucher_netoff" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "erp_invoice_voucher_netoff"
      ADD CONSTRAINT "FK_erp_invoice_voucher_netoff_invoice" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "erp_invoice_voucher_netoff"
      ADD CONSTRAINT "FK_erp_invoice_voucher_netoff_bank_transaction" FOREIGN KEY ("bank_transaction_id") REFERENCES "erp_bank_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" DROP CONSTRAINT "FK_erp_invoice_voucher_netoff_bank_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_voucher_netoff" DROP CONSTRAINT "FK_erp_invoice_voucher_netoff_invoice"`,
    );
    await queryRunner.query(`DROP TABLE "erp_invoice_voucher_netoff"`);
  }
}
