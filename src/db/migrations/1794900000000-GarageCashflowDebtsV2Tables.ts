import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ba bảng của thu chi + sổ công nợ garage v2: `cashflow_vouchers_garage`, `debts_garage`,
 * `debt_allocations_garage` (plan `garage-cashflow-debts-ledger-v2`, Phase 1).
 *
 * Gate 0 trên erp_greenway_staging (2026-11-17): cả ba bảng chưa tồn tại; nguồn backfill là
 * `kgara_cashflow_vouchers` (718), `kgara_case_settlements` (358). Tên PK/index/FK trùng tên
 * mặc định của TypeORM để `migration:generate` không báo lệch.
 *
 * Chỉ tạo bảng; KHÔNG backfill (script riêng, mặc định dry-run). Mọi câu lệnh idempotent.
 * Không có FK từ `case_id` về `kgara_cases` để lõi v2 không gắn với bảng V1.
 */
export class GarageCashflowDebtsV2Tables1794900000000 implements MigrationInterface {
  name = 'GarageCashflowDebtsV2Tables1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashflow_vouchers_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "branch_external_id" varchar(100) NOT NULL,
        "voucher_code" varchar(50) NOT NULL,
        "voucher_type" varchar(20) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "trans_date" date NOT NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "case_id" uuid,
        "license_plate" varchar(50),
        "payment_method" varchar(50),
        "payment_content" varchar(100),
        "partner_name" varchar(255),
        "payer_type" varchar(10) NOT NULL DEFAULT 'KH',
        "erp_bank_transaction_id" uuid,
        "erp_cash_voucher_id" uuid,
        "note" text,
        "source" varchar(20) NOT NULL DEFAULT 'MANUAL',
        "created_by" varchar(255),
        "is_auto_expected" boolean NOT NULL DEFAULT false,
        "is_auto_commission" boolean NOT NULL DEFAULT false,
        "pnl_period_year" smallint,
        "pnl_period_month" smallint,
        "pnl_commission_type" varchar(20),
        "pnl_commission_anchor_id" uuid,
        CONSTRAINT "PK_976780b49fab98c5726ac03dd99" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_206a764af2fb531cd054fbb1b0"
        ON "cashflow_vouchers_garage" ("voucher_code");
      CREATE INDEX IF NOT EXISTS "IDX_5275a286b1f5fade3f1cf35cac"
        ON "cashflow_vouchers_garage" ("is_deleted");
      CREATE INDEX IF NOT EXISTS "IDX_cd67a87f1955d65041f598a8af"
        ON "cashflow_vouchers_garage" ("branch_external_id");
      CREATE INDEX IF NOT EXISTS "IDX_2b05faa03de5cda5a9dc058f3f"
        ON "cashflow_vouchers_garage" ("voucher_type");
      CREATE INDEX IF NOT EXISTS "IDX_16d8a3448d70c92b5d5a41dcb7"
        ON "cashflow_vouchers_garage" ("status");
      CREATE INDEX IF NOT EXISTS "IDX_fbaab79e8bf4135e7fe4f9c21b"
        ON "cashflow_vouchers_garage" ("trans_date");
      CREATE INDEX IF NOT EXISTS "IDX_68189c98e90a8236bb3bdb576a"
        ON "cashflow_vouchers_garage" ("case_id");
      CREATE INDEX IF NOT EXISTS "IDX_cashflow_vouchers_garage_branch_date"
        ON "cashflow_vouchers_garage" ("branch_external_id", "trans_date");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "debts_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "branch_external_id" varchar(100) NOT NULL,
        "source_type" varchar(30) NOT NULL,
        "source_id" varchar(64) NOT NULL,
        "case_id" uuid,
        "direction" varchar(20) NOT NULL,
        "party_type" varchar(20) NOT NULL,
        "partner_id" uuid,
        "party_code" varchar(100) NOT NULL,
        "party_name" varchar(255),
        "license_plate" varchar(50),
        "original_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "settled_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "balance_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "due_base_date" date,
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "excluded" boolean NOT NULL DEFAULT false,
        "origin" varchar(20) NOT NULL DEFAULT 'SYNC',
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_152cc10c8ee7c2544dfbb9d48b8" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_debts_garage_origin"
          UNIQUE ("source_type", "source_id", "direction", "party_type")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_3a0d26d67d30f56b924d926be8"
        ON "debts_garage" ("is_deleted");
      CREATE INDEX IF NOT EXISTS "IDX_6c838424e1fc98cbccbb546b03"
        ON "debts_garage" ("branch_external_id");
      CREATE INDEX IF NOT EXISTS "IDX_cfac97a07a92458742feeb263f"
        ON "debts_garage" ("case_id");
      CREATE INDEX IF NOT EXISTS "IDX_0c67de9f8999573133658d8c2e"
        ON "debts_garage" ("partner_id");
      CREATE INDEX IF NOT EXISTS "IDX_16459a6432e08e6bded626c619"
        ON "debts_garage" ("due_base_date");
      CREATE INDEX IF NOT EXISTS "IDX_debts_garage_scope"
        ON "debts_garage" ("branch_external_id", "direction", "party_type", "status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "debt_allocations_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "branch_external_id" varchar(100) NOT NULL,
        "debt_id" uuid NOT NULL,
        "source_type" varchar(30) NOT NULL,
        "source_id" varchar(64),
        "voucher_id" uuid,
        "amount" numeric(18,2) NOT NULL,
        "payer_type" varchar(10) NOT NULL DEFAULT 'KH',
        "trans_date" date,
        "idempotency_key" varchar(128) NOT NULL,
        "reversed_at" timestamptz,
        "reversal_of_id" uuid,
        "origin" varchar(20) NOT NULL DEFAULT 'NATIVE',
        "actor_id" varchar(64),
        CONSTRAINT "PK_e6a4a56d48cce1e6c2c48c114be" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_debt_allocations_garage_idempotency" UNIQUE ("idempotency_key")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_24e74cd8e4785a3ddc66b29e89"
        ON "debt_allocations_garage" ("branch_external_id");
      CREATE INDEX IF NOT EXISTS "IDX_852234771aa4f9aa1dd9f6a548"
        ON "debt_allocations_garage" ("debt_id");
      CREATE INDEX IF NOT EXISTS "IDX_9e41fd40d2a7a57bbd5f380ab9"
        ON "debt_allocations_garage" ("voucher_id");
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_852234771aa4f9aa1dd9f6a5486'
        ) THEN
          ALTER TABLE "debt_allocations_garage"
            ADD CONSTRAINT "FK_852234771aa4f9aa1dd9f6a5486"
            FOREIGN KEY ("debt_id") REFERENCES "debts_garage"("id")
            ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  /**
   * Hoàn tác: bỏ ba bảng theo thứ tự ngược FK. Từ chối khi bảng đã có dữ liệu để không xóa nhầm
   * sổ nợ, phân bổ, phiếu đã ghi ở v2 (bảng `kgara_*` không đổi). Muốn bỏ thật thì dọn dữ liệu trước.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'debt_allocations_garage',
      'debts_garage',
      'cashflow_vouchers_garage',
    ]) {
      const [exists] = await queryRunner.query(
        `SELECT to_regclass($1) AS reg`,
        [`public.${table}`],
      );
      if (!exists?.reg) continue;
      const [row] = await queryRunner.query(
        `SELECT count(*)::int AS n FROM "${table}"`,
      );
      if (row.n > 0) {
        throw new Error(
          `Từ chối hoàn tác: bảng ${table} còn ${row.n} dòng dữ liệu v2.`,
        );
      }
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "debt_allocations_garage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "debts_garage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cashflow_vouchers_garage";`);
  }
}
