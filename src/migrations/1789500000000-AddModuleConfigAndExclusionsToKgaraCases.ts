import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModuleConfigAndExclusionsToKgaraCases1789500000000 implements MigrationInterface {
  name = 'AddModuleConfigAndExclusionsToKgaraCases1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add columns to kgara_cases
    await queryRunner.query(`
      ALTER TABLE "kgara_cases" 
      ADD COLUMN IF NOT EXISTS "category_id" UUID NULL,
      ADD COLUMN IF NOT EXISTS "exclude_from_reports" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "exclude_from_debt" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 2. Add foreign key constraint if not exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_kgara_cases_category_id'
        ) THEN
          ALTER TABLE "kgara_cases"
          ADD CONSTRAINT "fk_kgara_cases_category_id"
          FOREIGN KEY ("category_id") 
          REFERENCES "erp_module_categories"("id") 
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 3. Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kgara_cases_category_id" ON "kgara_cases"("category_id");
      CREATE INDEX IF NOT EXISTS "idx_kgara_cases_exclude_from_reports" ON "kgara_cases"("exclude_from_reports");
      CREATE INDEX IF NOT EXISTS "idx_kgara_cases_exclude_from_debt" ON "kgara_cases"("exclude_from_debt");
    `);

    // 4. Seed categories for GARAGE_CASE in erp_module_categories
    await queryRunner.query(`
      INSERT INTO "erp_module_categories" ("id", "module_key", "code", "name", "name_en", "description", "is_active", "is_deleted", "created_at", "updated_at")
      VALUES
        (gen_random_uuid(), 'GARAGE_CASE', 'SUA_CHUA_CHUNG', 'Sửa chữa chung', 'General Repair', 'Vụ việc sửa chữa, bảo dưỡng xe định kỳ và thay thế phụ tùng', true, false, now(), now()),
        (gen_random_uuid(), 'GARAGE_CASE', 'KY_GUI_NOI_BO', 'Ký gửi / Nội bộ', 'Consignment & Internal', 'Vụ việc sửa chữa xe nội bộ công ty hoặc xe ký gửi', true, false, now(), now()),
        (gen_random_uuid(), 'GARAGE_CASE', 'OJ_NGOAI', 'Xe ngoài (OJ)', 'External OJ', 'Vụ việc gia công, sửa chữa ngoài xưởng hoặc dịch vụ OJ', true, false, now(), now()),
        (gen_random_uuid(), 'GARAGE_CASE', 'KHAC', 'Khác', 'Other', 'Các vụ việc phân loại khác hoặc quà tặng bán hàng', true, false, now(), now())
      ON CONFLICT ("module_key", "code") DO UPDATE SET
        "name" = EXCLUDED."name",
        "name_en" = EXCLUDED."name_en",
        "description" = EXCLUDED."description",
        "is_active" = true,
        "is_deleted" = false,
        "updated_at" = now();
    `);

    // 5. Seed 2 system global attributes in erp_module_attribute_defs
    const tableRes = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_module_attribute_defs', 'erp_bom_attribute_defs')
      ORDER BY CASE WHEN table_name = 'erp_module_attribute_defs' THEN 1 ELSE 2 END
      LIMIT 1;
    `);
    const attrDefsTable =
      tableRes?.[0]?.table_name || 'erp_module_attribute_defs';

    await queryRunner.query(`
      INSERT INTO "${attrDefsTable}" (
        "id", "is_global", "module_key_global", "code", "name", "name_en", 
        "field_type", "sort_order", "is_required", "is_active", "is_system", "is_deleted", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(), true, 'GARAGE_CASE', 'exclude_from_reports', 'Không tính vào báo cáo', 'Exclude from Reports',
        'CHECKBOX', 10, false, true, true, false, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "${attrDefsTable}" 
        WHERE "is_global" = true AND "module_key_global" = 'GARAGE_CASE' AND "code" = 'exclude_from_reports'
      );

      INSERT INTO "${attrDefsTable}" (
        "id", "is_global", "module_key_global", "code", "name", "name_en", 
        "field_type", "sort_order", "is_required", "is_active", "is_system", "is_deleted", "created_at", "updated_at"
      )
      SELECT 
        gen_random_uuid(), true, 'GARAGE_CASE', 'exclude_from_debt', 'Không tính công nợ doanh thu / chi phí', 'Exclude from Receivables & Payables',
        'CHECKBOX', 20, false, true, true, false, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "${attrDefsTable}" 
        WHERE "is_global" = true AND "module_key_global" = 'GARAGE_CASE' AND "code" = 'exclude_from_debt'
      );
    `);

    // 6. Data Migration: Backfill category_id for existing kgara_cases based on classification
    await queryRunner.query(`
      -- SUA_CHUA_CHUNG
      UPDATE "kgara_cases" c
      SET "category_id" = (
        SELECT "id" FROM "erp_module_categories" 
        WHERE "module_key" = 'GARAGE_CASE' AND "code" = 'SUA_CHUA_CHUNG' LIMIT 1
      )
      WHERE c."category_id" IS NULL 
        AND (c."classification" = 'SUA_CHUA_CHUNG' OR c."classification" ILIKE '%sửa chữa%');

      -- KY_GUI_NOI_BO
      UPDATE "kgara_cases" c
      SET "category_id" = (
        SELECT "id" FROM "erp_module_categories" 
        WHERE "module_key" = 'GARAGE_CASE' AND "code" = 'KY_GUI_NOI_BO' LIMIT 1
      )
      WHERE c."category_id" IS NULL 
        AND (c."classification" IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') OR c."classification" ILIKE '%ký gửi%' OR c."classification" ILIKE '%nội bộ%');

      -- OJ_NGOAI
      UPDATE "kgara_cases" c
      SET "category_id" = (
        SELECT "id" FROM "erp_module_categories" 
        WHERE "module_key" = 'GARAGE_CASE' AND "code" = 'OJ_NGOAI' LIMIT 1
      )
      WHERE c."category_id" IS NULL 
        AND (c."classification" IN ('OJ', 'OJ_NGOAI') OR c."classification" ILIKE '%oj%');

      -- KHAC
      UPDATE "kgara_cases" c
      SET "category_id" = (
        SELECT "id" FROM "erp_module_categories" 
        WHERE "module_key" = 'GARAGE_CASE' AND "code" = 'KHAC' LIMIT 1
      )
      WHERE c."category_id" IS NULL 
        AND c."classification" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_cases" DROP CONSTRAINT IF EXISTS "fk_kgara_cases_category_id";
      DROP INDEX IF EXISTS "idx_kgara_cases_category_id";
      DROP INDEX IF EXISTS "idx_kgara_cases_exclude_from_reports";
      DROP INDEX IF EXISTS "idx_kgara_cases_exclude_from_debt";
      ALTER TABLE "kgara_cases" 
        DROP COLUMN IF EXISTS "category_id",
        DROP COLUMN IF EXISTS "exclude_from_reports",
        DROP COLUMN IF EXISTS "exclude_from_debt";
    `);
  }
}
