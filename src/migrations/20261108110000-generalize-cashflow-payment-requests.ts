import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DNTT (đề nghị thanh toán) tổng quát hóa cho PO garage:
 * - Dòng DNTT có thể trỏ một dự chi (forecast_id) hoặc một chứng từ khác qua (ref_type, ref_id), ví dụ GARAGE_PO.
 * - Thêm trạng thái PARTIAL, cờ requires_approval, NCC và dấu hủy.
 * - Bảng line_payments: thực chi nào trả cho dòng DNTT nào (làm căn cứ tính payment_status của PO).
 * Thuần additive, chạy được trên DB đã có dữ liệu.
 */
export class GeneralizeCashflowPaymentRequests20261108110000 implements MigrationInterface {
  name = 'GeneralizeCashflowPaymentRequests20261108110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_requests"
        DROP CONSTRAINT IF EXISTS "ck_cashflow_payment_requests_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_requests"
        ADD CONSTRAINT "ck_cashflow_payment_requests_status" CHECK ("status" IN (
          'DRAFT','PENDING_APPROVAL','REJECTED','APPROVED','PARTIAL','PAID','CANCELLED'))
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_requests"
        ADD COLUMN IF NOT EXISTS "requires_approval" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "supplier_id" uuid NULL,
        ADD COLUMN IF NOT EXISTS "cancelled_by" uuid NULL,
        ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "cancel_reason" text NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_request_lines"
        ALTER COLUMN "forecast_id" DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS "ref_type" varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS "ref_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_request_lines"
        DROP CONSTRAINT IF EXISTS "ck_cashflow_payment_request_lines_ref"
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_request_lines"
        ADD CONSTRAINT "ck_cashflow_payment_request_lines_ref" CHECK (
          ("forecast_id" IS NOT NULL OR "ref_id" IS NOT NULL)
          AND (("ref_type" IS NULL) = ("ref_id" IS NULL))
        )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_payment_request_lines_ref" ON "cashflow_payment_request_lines" ("ref_type", "ref_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_payment_request_line_payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "payment_id" uuid NOT NULL REFERENCES "cashflow_payments"("id") ON DELETE CASCADE,
        "line_id" uuid NOT NULL REFERENCES "cashflow_payment_request_lines"("id") ON DELETE RESTRICT,
        "amount" numeric(18,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_payment_request_line_payments_amount" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_pr_line_payments_line" ON "cashflow_payment_request_line_payments" ("line_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_cashflow_pr_line_payments_pair" ON "cashflow_payment_request_line_payments" ("payment_id", "line_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không xóa dữ liệu thật: dừng nếu đã có dòng dùng cột mới.
    const [{ n: payments }] = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "cashflow_payment_request_line_payments"`,
    );
    const [{ n: refLines }] = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "cashflow_payment_request_lines" WHERE "forecast_id" IS NULL`,
    );
    if (payments > 0 || refLines > 0) {
      throw new Error(
        `Không thể rollback M1: còn ${payments} thực chi theo dòng và ${refLines} dòng DNTT trỏ chứng từ khác`,
      );
    }

    await queryRunner.query(
      `DROP TABLE IF EXISTS "cashflow_payment_request_line_payments"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ix_cashflow_payment_request_lines_ref"`,
    );
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_request_lines"
        DROP CONSTRAINT IF EXISTS "ck_cashflow_payment_request_lines_ref",
        DROP COLUMN IF EXISTS "ref_id",
        DROP COLUMN IF EXISTS "ref_type",
        ALTER COLUMN "forecast_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_requests"
        DROP COLUMN IF EXISTS "cancel_reason",
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancelled_by",
        DROP COLUMN IF EXISTS "supplier_id",
        DROP COLUMN IF EXISTS "requires_approval"
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_requests"
        DROP CONSTRAINT IF EXISTS "ck_cashflow_payment_requests_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "cashflow_payment_requests"
        ADD CONSTRAINT "ck_cashflow_payment_requests_status" CHECK ("status" IN (
          'DRAFT','PENDING_APPROVAL','REJECTED','APPROVED','PAID','CANCELLED'))
    `);
  }
}
