import { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerCascade1786414442074 implements MigrationInterface {
  name = 'LedgerCascade1786414442074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT IF EXISTS "fk_erp_invoices_journal_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" DROP CONSTRAINT IF EXISTS "FK_adjustment_lines_adjustment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_email_attachments" DROP CONSTRAINT IF EXISTS "FK_erp_email_attachments_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_email_attachments" DROP CONSTRAINT IF EXISTS "FK_erp_email_attachments_sys_file"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT IF EXISTS "FK_82867af4c8456519a4bfcb536a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT IF EXISTS "FK_aff5a0ae2e1992a54a34a4cf679"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_kgara_gross_profit_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP CONSTRAINT IF EXISTS "UQ_kgara_case_linked_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP COLUMN IF EXISTS "invoice_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" RENAME COLUMN "invoice_no_normalized" TO "TEMP_OLD_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "invoice_no_normalized" character varying(100)`,
    );
    await queryRunner.query(
      `UPDATE "erp_invoices" SET "invoice_no_normalized" = "TEMP_OLD_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "TEMP_OLD_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      [
        'GENERATED_COLUMN',
        'invoice_no_normalized',
        'neondb',
        'public',
        'erp_invoices',
      ],
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_82867af4c8456519a4bfcb536a9" FOREIGN KEY ("invoice_item_id") REFERENCES "erp_invoice_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_aff5a0ae2e1992a54a34a4cf679" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT "FK_aff5a0ae2e1992a54a34a4cf679"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT "FK_82867af4c8456519a4bfcb536a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "invoice_no_normalized" character varying(100)`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'neondb',
        'public',
        'erp_invoices',
        'GENERATED_COLUMN',
        'invoice_no_normalized',
        '',
      ],
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD "invoice_category" character varying(32) NOT NULL DEFAULT 'NORMAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD CONSTRAINT "UQ_kgara_case_linked_invoice" UNIQUE ("caseDbId", "invoiceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_kgara_gross_profit_branch" ON "kgara_gross_profit" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoice_no_normalized" ON "erp_invoices" ("direction", "invoice_no_normalized", "seller_tax_code") `,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_aff5a0ae2e1992a54a34a4cf679" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_82867af4c8456519a4bfcb536a9" FOREIGN KEY ("invoice_item_id") REFERENCES "erp_invoice_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_email_attachments" ADD CONSTRAINT "FK_erp_email_attachments_sys_file" FOREIGN KEY ("sysFileId") REFERENCES "sys_files"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_email_attachments" ADD CONSTRAINT "FK_erp_email_attachments_message" FOREIGN KEY ("messageId") REFERENCES "erp_email_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ADD CONSTRAINT "FK_adjustment_lines_adjustment" FOREIGN KEY ("adjustment_id") REFERENCES "erp_inventory_adjustments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD CONSTRAINT "fk_erp_invoices_journal_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "erp_journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
