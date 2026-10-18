import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEInvoiceSyncsAndExtendInvoices20261006233500 implements MigrationInterface {
  name = 'CreateEInvoiceSyncsAndExtendInvoices20261006233500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create table erp_einvoice_syncs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_einvoice_syncs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_tax_code" VARCHAR(20) NOT NULL,
        "sync_type" VARCHAR(20) NOT NULL,
        "query_type" VARCHAR(20) NOT NULL,
        "from_date" TIMESTAMPTZ NOT NULL,
        "to_date" TIMESTAMPTZ NOT NULL,
        "total_found" INT DEFAULT 0,
        "total_pdf_success" INT DEFAULT 0,
        "total_pdf_failed" INT DEFAULT 0,
        "status" VARCHAR(30) DEFAULT 'in_progress',
        "error_message" TEXT,
        "created_by" UUID,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_einvoice_syncs_tax_date"
        ON "erp_einvoice_syncs"("company_tax_code", "from_date", "to_date");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_einvoice_syncs_status"
        ON "erp_einvoice_syncs"("status");
    `);

    // 2. Extend table erp_invoices
    await queryRunner.query(`
      ALTER TABLE "erp_invoices"
        ADD COLUMN IF NOT EXISTS "sync_id" UUID,
        ADD COLUMN IF NOT EXISTS "msttcgp" VARCHAR(20),
        ADD COLUMN IF NOT EXISTS "provider_code" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "lookup_url" TEXT,
        ADD COLUMN IF NOT EXISTS "lookup_code" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "pdf_path" TEXT,
        ADD COLUMN IF NOT EXISTS "pdf_source" VARCHAR(30),
        ADD COLUMN IF NOT EXISTS "pdf_error" TEXT;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_erp_invoices_sync_id'
        ) THEN
          ALTER TABLE "erp_invoices"
            ADD CONSTRAINT "fk_erp_invoices_sync_id"
            FOREIGN KEY ("sync_id") REFERENCES "erp_einvoice_syncs"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_invoices_provider_code"
        ON "erp_invoices"("provider_code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_invoices_pdf_source"
        ON "erp_invoices"("pdf_source");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_invoices_sync_id"
        ON "erp_invoices"("sync_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_invoices"
        DROP CONSTRAINT IF EXISTS "fk_erp_invoices_sync_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_erp_invoices_sync_id";
      DROP INDEX IF EXISTS "idx_erp_invoices_pdf_source";
      DROP INDEX IF EXISTS "idx_erp_invoices_provider_code";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_invoices"
        DROP COLUMN IF EXISTS "sync_id",
        DROP COLUMN IF EXISTS "msttcgp",
        DROP COLUMN IF EXISTS "provider_code",
        DROP COLUMN IF EXISTS "lookup_url",
        DROP COLUMN IF EXISTS "lookup_code",
        DROP COLUMN IF EXISTS "pdf_path",
        DROP COLUMN IF EXISTS "pdf_source",
        DROP COLUMN IF EXISTS "pdf_error";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "erp_einvoice_syncs";
    `);
  }
}
