import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKgaraCashflowVoucher1791505856412 implements MigrationInterface {
  name = 'CreateKgaraCashflowVoucher1791505856412';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_module_categories" DROP CONSTRAINT IF EXISTS "fk_module_cat_default_debit_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_attribute_defs" DROP CONSTRAINT IF EXISTS "FK_10ae3e466d992c2cfcfdc54f25a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP CONSTRAINT IF EXISTS "FK_f4e73d6075738899b2b12b431cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP CONSTRAINT IF EXISTS "FK_cc0e2f913d64679a34fd8c32bfa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT IF EXISTS "fk_erp_invoices_sync_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP CONSTRAINT IF EXISTS "FK_adj_netoff_adjusting_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP CONSTRAINT IF EXISTS "FK_adj_netoff_original_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP CONSTRAINT IF EXISTS "fk_kgara_cases_category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP CONSTRAINT IF EXISTS "FK_6e937903765c8d68d47390b0fd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT IF EXISTS "FK_5e3639f167165989d93fbdb0e6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_operating_expenses" DROP CONSTRAINT IF EXISTS "erp_operating_expenses_linked_invoice_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_operating_expenses" DROP CONSTRAINT IF EXISTS "erp_operating_expenses_journal_entry_id_fkey"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_2219ee4b8e2983169c680ccab7"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_module_cat_default_debit_account"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_25ecf7b7399cc2801ac5f9e695"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_einvoice_syncs_tax_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_einvoice_syncs_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_invoices_provider_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_invoices_pdf_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_invoices_sync_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_invoices_related_lookup"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_invoices_effective_data_gin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_adj_netoff_original_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_adj_netoff_adjusting_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_inv_tracking_item_status_fifo"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_kgara_cases_kgara_classification"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_kgara_cases_kgara_classification_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_kgara_cases_category_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_kgara_cases_exclude_from_reports"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_kgara_cases_exclude_from_debt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_opex_posting_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_opex_linked_invoice"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_opex_accrual_mode"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_sys_ops_module_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_sys_ops_scope_target"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP CONSTRAINT IF EXISTS "UQ_adj_netoff_pair"`,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_cashflow_vouchers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "voucher_code" character varying(50) NOT NULL, "voucher_type" character varying(20) NOT NULL, "amount" numeric(18,2) NOT NULL DEFAULT '0', "trans_date" date NOT NULL, "case_id" uuid, "erp_bank_transaction_id" uuid, "erp_cash_voucher_id" uuid, "note" text, "created_by" character varying(50), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f0a6959be63d1ad26737b7d9270" UNIQUE ("voucher_code"), CONSTRAINT "PK_cb6e1b3900a97148b879fc083dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gara_cashflow_trans_date" ON "kgara_cashflow_vouchers" ("trans_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gara_cashflow_case" ON "kgara_cashflow_vouchers" ("case_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gara_cashflow_code" ON "kgara_cashflow_vouchers" ("voucher_code") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN "category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN "category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN "category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_settlements" ADD "cashflow_voucher_id" uuid`,
    );

    // --- DATA MIGRATION: Copy existing settlements to cashflow vouchers ---
    await queryRunner.query(`
            INSERT INTO "kgara_cashflow_vouchers" (
                "id", "voucher_code", "voucher_type", "amount", 
                "trans_date", "case_id", "erp_bank_transaction_id", 
                "note", "created_at", "updated_at"
            )
            SELECT 
                "id",
                'MIG-' || to_char(COALESCE("trans_date", "created_at"::date), 'YYYYMMDD') || '-' || upper(left("id"::text, 6)),
                "settlement_type",
                "amount",
                COALESCE("trans_date", "created_at"::date),
                "case_id",
                "bank_transaction_id",
                "note",
                "created_at",
                "updated_at"
            FROM "kgara_case_settlements"
        `);

    await queryRunner.query(`
            UPDATE "kgara_case_settlements"
            SET "cashflow_voucher_id" = "id"
        `);
    // ----------------------------------------------------------------------

    await queryRunner.query(
      `COMMENT ON COLUMN "erp_module_categories"."default_debit_account_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "total_found" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "total_pdf_success" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "total_pdf_failed" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "status" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_serials" ALTER COLUMN "source_document_type" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_ai_configs" ALTER COLUMN "temperature" SET DEFAULT '0.2'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5901f842c2db8ac739755f6269" ON "erp_module_categories" ("module_key", "code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8c6779c479836e5ea7e920174a" ON "erp_module_attribute_defs" ("category_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da3e9325f518a62ef6afcfd826" ON "erp_einvoice_syncs" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2659eed1627d4c2c97e9b449a" ON "erp_einvoice_syncs" ("company_tax_code", "from_date", "to_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_993d29f39860238c0172772f62" ON "erp_invoices" ("provider_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95a22a4c921accfd6987c89802" ON "erp_invoices" ("pdf_source") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_380183e91095029db0b6b54e86" ON "kgara_cases" ("kgara_classification") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fb8e5a4953d522a2eb571cc83" ON "kgara_cases" ("kgara_classification_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_778ced73ef3ad2834b4dbfafe0" ON "kgara_cases" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b5a551525303be1eb3151ffac" ON "kgara_cases" ("exclude_from_reports") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70e0eda48c2879affd2d5d5ff7" ON "kgara_cases" ("exclude_from_debt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_categories" ADD CONSTRAINT "FK_0a5653cf4a885abc86855e30b11" FOREIGN KEY ("default_debit_account_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_attribute_defs" ADD CONSTRAINT "FK_91e633b66ae100323e3734e49bb" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD CONSTRAINT "FK_42d70fecc1fe3a4289e6607ef07" FOREIGN KEY ("sync_id") REFERENCES "erp_einvoice_syncs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD CONSTRAINT "FK_3e1c9137df6000e5533c6818f38" FOREIGN KEY ("original_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD CONSTRAINT "FK_969f2017f7a4ec27bc4756d532d" FOREIGN KEY ("adjusting_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD CONSTRAINT "FK_778ced73ef3ad2834b4dbfafe0c" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD CONSTRAINT "FK_8961ff2830b96c745e78f5ce58a" FOREIGN KEY ("case_id") REFERENCES "kgara_cases"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD CONSTRAINT "FK_197751d82d4959fb447b124b485" FOREIGN KEY ("erp_bank_transaction_id") REFERENCES "erp_bank_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_settlements" ADD CONSTRAINT "FK_5deb92adacd85c4555be61a1b93" FOREIGN KEY ("cashflow_voucher_id") REFERENCES "kgara_cashflow_vouchers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_5e3639f167165989d93fbdb0e6e" FOREIGN KEY ("part_sku") REFERENCES "vinfast_parts_catalog"("sku") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT IF EXISTS "FK_5e3639f167165989d93fbdb0e6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_settlements" DROP CONSTRAINT IF EXISTS "FK_5deb92adacd85c4555be61a1b93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP CONSTRAINT IF EXISTS "FK_197751d82d4959fb447b124b485"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP CONSTRAINT IF EXISTS "FK_8961ff2830b96c745e78f5ce58a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP CONSTRAINT IF EXISTS "FK_778ced73ef3ad2834b4dbfafe0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP CONSTRAINT IF EXISTS "FK_969f2017f7a4ec27bc4756d532d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP CONSTRAINT IF EXISTS "FK_3e1c9137df6000e5533c6818f38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT IF EXISTS "FK_42d70fecc1fe3a4289e6607ef07"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_attribute_defs" DROP CONSTRAINT IF EXISTS "FK_91e633b66ae100323e3734e49bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_categories" DROP CONSTRAINT IF EXISTS "FK_0a5653cf4a885abc86855e30b11"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_70e0eda48c2879affd2d5d5ff7"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_9b5a551525303be1eb3151ffac"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_778ced73ef3ad2834b4dbfafe0"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_7fb8e5a4953d522a2eb571cc83"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_380183e91095029db0b6b54e86"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_95a22a4c921accfd6987c89802"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_993d29f39860238c0172772f62"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_c2659eed1627d4c2c97e9b449a"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_da3e9325f518a62ef6afcfd826"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_8c6779c479836e5ea7e920174a"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_5901f842c2db8ac739755f6269"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_ai_configs" ALTER COLUMN "temperature" SET DEFAULT 0.2`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_system_operations" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_serials" ALTER COLUMN "source_document_type" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ADD "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "status" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "total_pdf_failed" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "total_pdf_success" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_einvoice_syncs" ALTER COLUMN "total_found" DROP NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "erp_module_categories"."default_debit_account_id" IS 'FK -> erp_chart_of_accounts. TK Nợ mặc định khi hạch toán hóa đơn. NULL = dùng static TT99 map hoặc fallback T0003.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_settlements" DROP COLUMN "cashflow_voucher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD "category_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD "category_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD "category_id" uuid`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_gara_cashflow_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_gara_cashflow_case"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_gara_cashflow_trans_date"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_cashflow_vouchers"`);
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD CONSTRAINT "UQ_adj_netoff_pair" UNIQUE ("original_invoice_id", "adjusting_invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sys_ops_scope_target" ON "erp_system_operations" ("scope_type", "target_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sys_ops_module_status" ON "erp_system_operations" ("module", "status", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_opex_accrual_mode" ON "erp_operating_expenses" ("accrual_mode") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_opex_linked_invoice" ON "erp_operating_expenses" ("linked_invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_opex_posting_status" ON "erp_operating_expenses" ("posting_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_kgara_cases_exclude_from_debt" ON "kgara_cases" ("exclude_from_debt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_kgara_cases_exclude_from_reports" ON "kgara_cases" ("exclude_from_reports") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_kgara_cases_category_id" ON "kgara_cases" ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_kgara_cases_kgara_classification_code" ON "kgara_cases" ("kgara_classification_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_kgara_cases_kgara_classification" ON "kgara_cases" ("kgara_classification") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_inv_tracking_item_status_fifo" ON "erp_inventory_tracking_serials" ("item_id", "status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_adj_netoff_adjusting_id" ON "erp_invoice_adjustment_netoff" ("adjusting_invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_adj_netoff_original_id" ON "erp_invoice_adjustment_netoff" ("original_invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_effective_data_gin" ON "erp_invoices" ("effective_data") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_related_lookup" ON "erp_invoices" ("direction", "related_invoice_no", "related_serial_no") WHERE (is_deleted = false)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_sync_id" ON "erp_invoices" ("sync_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_pdf_source" ON "erp_invoices" ("pdf_source") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_provider_code" ON "erp_invoices" ("provider_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_einvoice_syncs_status" ON "erp_einvoice_syncs" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_einvoice_syncs_tax_date" ON "erp_einvoice_syncs" ("company_tax_code", "from_date", "to_date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_25ecf7b7399cc2801ac5f9e695" ON "erp_module_attribute_defs" ("category_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_module_cat_default_debit_account" ON "erp_module_categories" ("default_debit_account_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2219ee4b8e2983169c680ccab7" ON "erp_module_categories" ("code", "module_key") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_operating_expenses" ADD CONSTRAINT "erp_operating_expenses_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "erp_journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_operating_expenses" ADD CONSTRAINT "erp_operating_expenses_linked_invoice_id_fkey" FOREIGN KEY ("linked_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_5e3639f167165989d93fbdb0e6e" FOREIGN KEY ("part_sku") REFERENCES "vinfast_parts_catalog"("sku") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" ADD CONSTRAINT "FK_6e937903765c8d68d47390b0fd7" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD CONSTRAINT "fk_kgara_cases_category_id" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD CONSTRAINT "FK_adj_netoff_original_invoice" FOREIGN KEY ("original_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_adjustment_netoff" ADD CONSTRAINT "FK_adj_netoff_adjusting_invoice" FOREIGN KEY ("adjusting_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD CONSTRAINT "fk_erp_invoices_sync_id" FOREIGN KEY ("sync_id") REFERENCES "erp_einvoice_syncs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD CONSTRAINT "FK_cc0e2f913d64679a34fd8c32bfa" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD CONSTRAINT "FK_f4e73d6075738899b2b12b431cd" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_attribute_defs" ADD CONSTRAINT "FK_10ae3e466d992c2cfcfdc54f25a" FOREIGN KEY ("category_id") REFERENCES "erp_module_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_categories" ADD CONSTRAINT "fk_module_cat_default_debit_account" FOREIGN KEY ("default_debit_account_id") REFERENCES "erp_chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
