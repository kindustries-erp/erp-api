import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachments1785379630275 implements MigrationInterface {
  name = 'CreateAttachments1785379630275';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT "fk_erp_invoices_journal_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" DROP CONSTRAINT "FK_core_notifications_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" DROP CONSTRAINT "FK_adjustment_lines_adjustment"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_core_refresh_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_core_refresh_tokens_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_core_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_kgara_gross_profit_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP CONSTRAINT "UQ_kgara_case_linked_invoice"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."erp_attachments_document_type_enum" AS ENUM('HOP_DONG', 'HOA_DON', 'BANG_KE', 'KHAC')`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_name" character varying(255) NOT NULL, "file_key" character varying(512) NOT NULL, "file_size" integer NOT NULL DEFAULT '0', "mime_type" character varying(128), "document_type" "public"."erp_attachments_document_type_enum" NOT NULL DEFAULT 'KHAC', "created_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_178eacea95cab8f9c0f3b7ba6d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_invoice_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "attachment_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cc566aab096e5f51dd7a9d9eb33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" DROP COLUMN "item_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_refresh_tokens" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_refresh_tokens" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
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
      `ALTER TABLE "erp_invoices" ALTER COLUMN "is_valid" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "buyer_cccd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "buyer_cccd" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP CONSTRAINT "UQ_inventory_adjustment_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "adjustment_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "adjustment_no" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "adjustment_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "adjustment_date" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "status" character varying(255) NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ALTER COLUMN "line_no" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ALTER COLUMN "qty_adjusted" TYPE numeric(15,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" DROP COLUMN "type_adjust"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ADD "type_adjust" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ALTER COLUMN "unit_cost" TYPE numeric(19,3)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f70e9129b7b408b21d9e268a2a" ON "core_refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_66a8cae007b49221e378c56bf0" ON "kgara_gross_profit" ("hd_phieu_dich_vu_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5a4a8cbc02d8355b5b49e9ce7e" ON "kgara_gross_profit" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6dd478dba82fb0e2312b4b2263" ON "erp_inventory_adjustments" ("adjustment_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d570e108f9fc60fb2d4a1010e" ON "erp_inventory_adjustment_lines" ("adjustment_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD CONSTRAINT "FK_e3608afcd5388e7d20cb51802e2" FOREIGN KEY ("sales_order_id") REFERENCES "erp_sales_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_attachments" ADD CONSTRAINT "FK_0f7ae1e52b9411de1b351aa38ed" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_attachments" ADD CONSTRAINT "FK_3b7546c104d49fd043c8aea775b" FOREIGN KEY ("attachment_id") REFERENCES "erp_attachments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD CONSTRAINT "FK_0f779805bfe7c4dae05af8ab0e1" FOREIGN KEY ("caseDbId") REFERENCES "kgara_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" ADD CONSTRAINT "FK_cf29f9ea01c960ddeac6ca05c57" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core_notifications" DROP CONSTRAINT "FK_cf29f9ea01c960ddeac6ca05c57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP CONSTRAINT "FK_0f779805bfe7c4dae05af8ab0e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_attachments" DROP CONSTRAINT "FK_3b7546c104d49fd043c8aea775b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_attachments" DROP CONSTRAINT "FK_0f7ae1e52b9411de1b351aa38ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP CONSTRAINT "FK_e3608afcd5388e7d20cb51802e2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d570e108f9fc60fb2d4a1010e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6dd478dba82fb0e2312b4b2263"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a4a8cbc02d8355b5b49e9ce7e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_66a8cae007b49221e378c56bf0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f70e9129b7b408b21d9e268a2a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ALTER COLUMN "unit_cost" TYPE numeric(15,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" DROP COLUMN "type_adjust"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ADD "type_adjust" character varying(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ALTER COLUMN "qty_adjusted" TYPE numeric(15,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ALTER COLUMN "line_no" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "status" character varying(20) NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "adjustment_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "adjustment_date" TIMESTAMP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "adjustment_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "adjustment_no" character varying(50) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD CONSTRAINT "UQ_inventory_adjustment_no" UNIQUE ("adjustment_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP COLUMN "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_linked_invoice" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "buyer_cccd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "buyer_cccd" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ALTER COLUMN "is_valid" DROP NOT NULL`,
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
      `ALTER TABLE "core_refresh_tokens" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_refresh_tokens" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ADD "item_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "updated_by" uuid`,
    );
    await queryRunner.query(`DROP TABLE "erp_invoice_attachments"`);
    await queryRunner.query(`DROP TABLE "erp_attachments"`);
    await queryRunner.query(
      `DROP TYPE "public"."erp_attachments_document_type_enum"`,
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
      `CREATE UNIQUE INDEX "UQ_core_refresh_tokens_token_hash" ON "core_refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_core_refresh_tokens_user_id" ON "core_refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_core_refresh_tokens_expires_at" ON "core_refresh_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" ADD CONSTRAINT "FK_adjustment_lines_adjustment" FOREIGN KEY ("adjustment_id") REFERENCES "erp_inventory_adjustments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_notifications" ADD CONSTRAINT "FK_core_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD CONSTRAINT "fk_erp_invoices_journal_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "erp_journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
