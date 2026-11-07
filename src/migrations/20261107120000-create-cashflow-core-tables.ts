import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lõi thu chi (cashflow-core) và phần Garage (cashflow-garage).
 * Chỉ tạo bảng mới, không sửa hay xóa bảng cũ (kgara_cashflow_vouchers, erp_garage_proc_requests...).
 * Dữ liệu cũ được chuyển ở bước backfill riêng, có dry-run và đối soát.
 *
 * Bảng:
 *   cashflow_forecasts               dự thu / dự chi (có số dư, tính từ phân bổ)
 *   cashflow_forecast_lines          dòng hàng của dự chi mua hàng
 *   cashflow_payment_requests        đề nghị thanh toán (DNTT), duyệt được
 *   cashflow_payment_request_lines   DNTT gán các dự chi
 *   cashflow_payments                thực thu / thực chi
 *   cashflow_allocations             nối payment với dự chi
 *   cashflow_garage_forecast_ext     mở rộng Garage cho dự thu/dự chi (1-1)
 *   cashflow_garage_payment_ext      mở rộng Garage cho thực thu/thực chi (1-1)
 */
export class CreateCashflowCoreTables20261107120000 implements MigrationInterface {
  name = 'CreateCashflowCoreTables20261107120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dự thu / dự chi
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_forecasts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL,
        "direction" varchar(3) NOT NULL,
        "kind" varchar(32) NOT NULL,
        "source" varchar(16) NOT NULL DEFAULT 'MANUAL',
        "source_type" varchar(64) NULL,
        "source_id" uuid NULL,
        "partner_id" uuid NULL,
        "partner_name" varchar(255) NULL,
        "branch_id" uuid NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "planned_date" date NULL,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "requires_approval" boolean NOT NULL DEFAULT false,
        "submitted_by" uuid NULL,
        "submitted_at" timestamptz NULL,
        "approver_id" uuid NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "rejected_by" uuid NULL,
        "rejected_at" timestamptz NULL,
        "reject_reason" text NULL,
        "note" text NULL,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_forecasts_direction" CHECK ("direction" IN ('IN','OUT')),
        CONSTRAINT "ck_cashflow_forecasts_kind" CHECK ("kind" IN ('PURCHASE','COMMISSION','CASE_RECEIVABLE','OTHER')),
        CONSTRAINT "ck_cashflow_forecasts_source" CHECK ("source" IN ('AUTO','MANUAL')),
        CONSTRAINT "ck_cashflow_forecasts_amount" CHECK ("amount" >= 0),
        CONSTRAINT "ck_cashflow_forecasts_status" CHECK ("status" IN (
          'DRAFT','PENDING_APPROVAL','REJECTED','OPEN','PARTIAL','SETTLED','CANCELLED'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_cashflow_forecasts_code" ON "cashflow_forecasts" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_forecasts_status_direction" ON "cashflow_forecasts" ("status", "direction")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_forecasts_branch" ON "cashflow_forecasts" ("branch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_forecasts_source" ON "cashflow_forecasts" ("source_type", "source_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_forecasts_planned_date" ON "cashflow_forecasts" ("planned_date")`,
    );

    // Dòng hàng của dự chi mua hàng
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_forecast_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "forecast_id" uuid NOT NULL REFERENCES "cashflow_forecasts"("id") ON DELETE CASCADE,
        "line_no" integer NOT NULL,
        "line_type" varchar(16) NOT NULL DEFAULT 'GOODS',
        "item_name" varchar(255) NOT NULL,
        "qty_requested" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_ordered" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_price" numeric(18,2) NOT NULL DEFAULT 0,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_forecast_lines_type" CHECK ("line_type" IN ('GOODS','SERVICE')),
        CONSTRAINT "ck_cashflow_forecast_lines_qty" CHECK ("qty_requested" >= 0 AND "qty_ordered" >= 0 AND "qty_ordered" <= "qty_requested")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_cashflow_forecast_lines_no" ON "cashflow_forecast_lines" ("forecast_id", "line_no")`,
    );

    // Đề nghị thanh toán (DNTT)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_payment_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL,
        "branch_id" uuid NULL,
        "partner_name" varchar(255) NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "submitted_by" uuid NULL,
        "submitted_at" timestamptz NULL,
        "approver_id" uuid NULL,
        "approved_by" uuid NULL,
        "approved_at" timestamptz NULL,
        "rejected_by" uuid NULL,
        "rejected_at" timestamptz NULL,
        "reject_reason" text NULL,
        "note" text NULL,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_payment_requests_amount" CHECK ("amount" >= 0),
        CONSTRAINT "ck_cashflow_payment_requests_status" CHECK ("status" IN (
          'DRAFT','PENDING_APPROVAL','REJECTED','APPROVED','PAID','CANCELLED'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_cashflow_payment_requests_code" ON "cashflow_payment_requests" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_payment_requests_status" ON "cashflow_payment_requests" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_payment_request_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "request_id" uuid NOT NULL REFERENCES "cashflow_payment_requests"("id") ON DELETE CASCADE,
        "forecast_id" uuid NOT NULL REFERENCES "cashflow_forecasts"("id") ON DELETE RESTRICT,
        "amount" numeric(18,2) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_payment_request_lines_amount" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_payment_request_lines_forecast" ON "cashflow_payment_request_lines" ("forecast_id")`,
    );

    // Thực thu / thực chi
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL,
        "direction" varchar(3) NOT NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "trans_date" date NOT NULL,
        "channel" varchar(16) NOT NULL DEFAULT 'OTHER',
        "bank_account_id" uuid NULL,
        "bank_transaction_id" uuid NULL,
        "payment_request_id" uuid NULL REFERENCES "cashflow_payment_requests"("id") ON DELETE SET NULL,
        "partner_id" uuid NULL,
        "partner_name" varchar(255) NULL,
        "branch_id" uuid NULL,
        "status" varchar(16) NOT NULL DEFAULT 'POSTED',
        "note" text NULL,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_payments_direction" CHECK ("direction" IN ('IN','OUT')),
        CONSTRAINT "ck_cashflow_payments_channel" CHECK ("channel" IN ('CASH','BANK','POS','OTHER')),
        CONSTRAINT "ck_cashflow_payments_status" CHECK ("status" IN ('POSTED','CANCELLED')),
        CONSTRAINT "ck_cashflow_payments_amount" CHECK ("amount" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_cashflow_payments_code" ON "cashflow_payments" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_payments_trans_date" ON "cashflow_payments" ("trans_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_payments_branch" ON "cashflow_payments" ("branch_id")`,
    );

    // Phân bổ: payment -> dự chi/dự thu
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_allocations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "payment_id" uuid NOT NULL REFERENCES "cashflow_payments"("id") ON DELETE CASCADE,
        "forecast_id" uuid NOT NULL REFERENCES "cashflow_forecasts"("id") ON DELETE RESTRICT,
        "amount" numeric(18,2) NOT NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_cashflow_allocations_amount" CHECK ("amount" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_allocations_forecast" ON "cashflow_allocations" ("forecast_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_allocations_payment" ON "cashflow_allocations" ("payment_id")`,
    );

    // Mở rộng Garage cho dự thu/dự chi
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_garage_forecast_ext" (
        "forecast_id" uuid PRIMARY KEY REFERENCES "cashflow_forecasts"("id") ON DELETE CASCADE,
        "case_id" uuid NULL,
        "license_plate" varchar(50) NULL,
        "payment_content" varchar(100) NULL,
        "is_auto_expected" boolean NOT NULL DEFAULT false,
        "is_auto_commission" boolean NOT NULL DEFAULT false,
        "pnl_period_year" smallint NULL,
        "pnl_period_month" smallint NULL,
        "pnl_commission_type" varchar(20) NULL,
        "pnl_commission_anchor_id" uuid NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_garage_forecast_ext_case" ON "cashflow_garage_forecast_ext" ("case_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_garage_forecast_ext_plate" ON "cashflow_garage_forecast_ext" ("license_plate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_garage_forecast_ext_content" ON "cashflow_garage_forecast_ext" ("payment_content")`,
    );

    // Mở rộng Garage cho thực thu/thực chi
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_garage_payment_ext" (
        "payment_id" uuid PRIMARY KEY REFERENCES "cashflow_payments"("id") ON DELETE CASCADE,
        "case_id" uuid NULL,
        "license_plate" varchar(50) NULL,
        "payment_content" varchar(100) NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_cashflow_garage_payment_ext_case" ON "cashflow_garage_payment_ext" ("case_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "cashflow_garage_payment_ext"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "cashflow_garage_forecast_ext"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cashflow_allocations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cashflow_payments"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "cashflow_payment_request_lines"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cashflow_payment_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cashflow_forecast_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cashflow_forecasts"`);
  }
}
