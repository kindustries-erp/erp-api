import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceAdjustmentNetoffAndEffectiveData1789600000000 implements MigrationInterface {
  name = 'AddInvoiceAdjustmentNetoffAndEffectiveData1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo bảng cấn trừ công nợ giữa HĐ Điều Chỉnh và HĐ Gốc
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_invoice_adjustment_netoff" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "original_invoice_id" uuid NOT NULL,
        "adjusting_invoice_id" uuid NOT NULL,
        "offset_amount" numeric(18, 2) NOT NULL DEFAULT 0,
        "offset_type" character varying(32) NOT NULL DEFAULT 'REDUCTION',
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_invoice_adjustment_netoff_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_adj_netoff_original_invoice" FOREIGN KEY ("original_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_adj_netoff_adjusting_invoice" FOREIGN KEY ("adjusting_invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_adj_netoff_pair" UNIQUE ("original_invoice_id", "adjusting_invoice_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_adj_netoff_original_id" 
      ON "erp_invoice_adjustment_netoff" ("original_invoice_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_adj_netoff_adjusting_id" 
      ON "erp_invoice_adjustment_netoff" ("adjusting_invoice_id")
    `);

    // 2. Bổ sung cột JSONB lưu thông tin hiệu lực và diff điều chỉnh
    await queryRunner.query(`
      ALTER TABLE "erp_invoices" 
      ADD COLUMN IF NOT EXISTS "effective_data" jsonb DEFAULT NULL
    `);

    // 3. Đánh GIN Index cho effective_data
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_invoices_effective_data_gin" 
      ON "erp_invoices" USING GIN ("effective_data")
    `);

    // 4. Composite Index phục vụ tra cứu liên kết 2 chiều giữa HĐ Gốc <-> HĐ Điều Chỉnh
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_invoices_related_lookup" 
      ON "erp_invoices" ("related_invoice_no", "related_serial_no", "direction")
      WHERE "is_deleted" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_erp_invoices_related_lookup"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_erp_invoices_effective_data_gin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "effective_data"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_invoice_adjustment_netoff"`,
    );
  }
}
