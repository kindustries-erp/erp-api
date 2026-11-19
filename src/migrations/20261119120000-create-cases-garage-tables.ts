import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hai bảng vụ việc garage v2: `cases_garage` (header) và `case_services_garage` (dòng hạng mục).
 * Plan `build-v2-garage-cases-crud`, Phase 1. Tên PK/index/FK trùng tên mặc định của TypeORM
 * để `migration:generate` không báo lệch. Chỉ tạo bảng; backfill là script riêng (dry-run mặc định).
 * Không FK về `kgara_*` để v2 không gắn với bảng V1. Mọi câu lệnh idempotent.
 */
export class CreateCasesGarageTables20261119120000 implements MigrationInterface {
  name = 'CreateCasesGarageTables20261119120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cases_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "origin" varchar(20) NOT NULL DEFAULT 'NATIVE',
        "legacy_case_id" uuid,
        "external_id" varchar(100),
        "case_code" varchar(100) NOT NULL,
        "branch_external_id" varchar(100) NOT NULL,
        "account_key" varchar(50) NOT NULL DEFAULT 'MAIN',
        "branch_id" uuid,
        "license_plate" varchar(50),
        "chassis_number" varchar(100),
        "vehicle_brand_code" varchar(100),
        "vehicle_brand_name" varchar(255),
        "vehicle_model_code" varchar(100),
        "vehicle_model_name" varchar(255),
        "manufacture_year" smallint,
        "customer_code" varchar(100),
        "customer_name" varchar(255),
        "customer_source_name" varchar(100),
        "customer_source_code" varchar(50),
        "payer_code" varchar(100),
        "payer_name" varchar(255),
        "status" varchar(30) NOT NULL DEFAULT 'INTAKE',
        "kgara_status_code" integer,
        "status_name" varchar(100),
        "issued_at" timestamptz,
        "received_at" timestamptz,
        "completed_at" timestamptz,
        "delivered_at" timestamptz,
        "total_amount_with_tax" numeric(18,2),
        "paid_amount" numeric(18,2),
        "outstanding_amount" numeric(18,2),
        "revenue" numeric(18,2),
        "cost" numeric(18,2),
        "profit" numeric(18,2),
        "category_id" uuid,
        "classification" varchar(100),
        "classification_manually_cleared" boolean NOT NULL DEFAULT false,
        "exclude_from_reports" boolean NOT NULL DEFAULT false,
        "exclude_from_debt" boolean NOT NULL DEFAULT false,
        "internal_notes" text,
        "external_deleted_at" timestamptz,
        "external_delete_count" integer NOT NULL DEFAULT 0,
        "created_by" uuid,
        CONSTRAINT "PK_85f31a4d201fddf818d1cda59a9" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dd1eac38bf159eb5b35421dc41" ON "cases_garage" ("is_deleted");
      CREATE INDEX IF NOT EXISTS "IDX_024961ea7dbfc29ff47b047996" ON "cases_garage" ("origin");
      CREATE INDEX IF NOT EXISTS "IDX_4fc60875aab7fc4fd1d3bb2aa3" ON "cases_garage" ("case_code");
      CREATE INDEX IF NOT EXISTS "IDX_fb5c03058b17394b22e851eb49" ON "cases_garage" ("branch_external_id");
      CREATE INDEX IF NOT EXISTS "IDX_ab173a354da214aa9ec20363c1" ON "cases_garage" ("chassis_number");
      CREATE INDEX IF NOT EXISTS "IDX_a362ced1907b4ab5078a7f5652" ON "cases_garage" ("vehicle_brand_code");
      CREATE INDEX IF NOT EXISTS "IDX_b902936fd58f36fda40552c68f" ON "cases_garage" ("payer_code");
      CREATE INDEX IF NOT EXISTS "IDX_e7ab08b6699abf12fa83050d02" ON "cases_garage" ("category_id");
      CREATE INDEX IF NOT EXISTS "IDX_8cba680f3fa6c99fc17621ac91" ON "cases_garage" ("classification");
      CREATE INDEX IF NOT EXISTS "IDX_fcd9d320044f3cbf4a87a4ad39" ON "cases_garage" ("external_deleted_at");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cases_garage_legacy_case_id"
        ON "cases_garage" ("legacy_case_id");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cases_garage_external_id"
        ON "cases_garage" ("external_id") WHERE "external_id" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cases_garage_case_code_active"
        ON "cases_garage" ("branch_external_id", "account_key", "case_code")
        WHERE "is_deleted" = false AND "external_deleted_at" IS NULL;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.branches_management') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'FK_cases_garage_branch_id'
           ) THEN
          ALTER TABLE "cases_garage"
            ADD CONSTRAINT "FK_cases_garage_branch_id"
            FOREIGN KEY ("branch_id") REFERENCES "branches_management"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case_services_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "case_id" uuid NOT NULL,
        "legacy_service_id" uuid,
        "external_id" varchar(100),
        "account_key" varchar(50) NOT NULL DEFAULT 'MAIN',
        "line_number" integer NOT NULL DEFAULT 0,
        "description" text,
        "product_code" varchar(100),
        "product_name" varchar(255),
        "product_type_code" varchar(50),
        "unit_name" varchar(50),
        "quantity" numeric(18,4),
        "unit_price" numeric(18,2),
        "amount_before_tax" numeric(18,2),
        "tax_rate" numeric(5,2),
        "amount_with_tax" numeric(18,2),
        "labor_hours" numeric(18,2),
        "service_amount" numeric(18,2),
        "parts_amount" numeric(18,2),
        "parts_cost" numeric(18,2),
        "line_discount_rate" numeric(18,2),
        "line_discount_amount" numeric(18,2),
        "surcharge_amount" numeric(18,2),
        "warehouse_code" varchar(100),
        "external_deleted_at" timestamptz,
        CONSTRAINT "PK_17eba79f51ea3fec1ccc946c0d3" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_7d8ed4d97796103a5056817786" ON "case_services_garage" ("case_id");
      CREATE INDEX IF NOT EXISTS "IDX_9a0460b279d28a5ae9d35d63ab" ON "case_services_garage" ("external_deleted_at");
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_case_services_garage_legacy_service_id"
        ON "case_services_garage" ("legacy_service_id");
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_7d8ed4d97796103a50568177862'
        ) THEN
          ALTER TABLE "case_services_garage"
            ADD CONSTRAINT "FK_7d8ed4d97796103a50568177862"
            FOREIGN KEY ("case_id") REFERENCES "cases_garage"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "case_services_garage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cases_garage";`);
  }
}
