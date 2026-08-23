import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntityCustomFieldsTable1787400000001 implements MigrationInterface {
  name = 'CreateEntityCustomFieldsTable1787400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create erp_entity_attribute_values table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_entity_attribute_values" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "entity_type" varchar(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "category_id" uuid NULL,
        "attr_def_id" uuid NOT NULL,
        "value_text" text NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_entity_attribute_values" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_entity_attribute_values_entity_attr" UNIQUE ("entity_type", "entity_id", "attr_def_id"),
        CONSTRAINT "FK_erp_entity_attribute_values_category" FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_erp_entity_attribute_values_attr_def" FOREIGN KEY ("attr_def_id") REFERENCES "erp_bom_attribute_defs"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_entity_attribute_values_entity" ON "erp_entity_attribute_values" ("entity_type", "entity_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_entity_attribute_values_attr_def" ON "erp_entity_attribute_values" ("attr_def_id");
    `);

    // 2. Add category_id to erp_invoices
    await queryRunner.query(`
      ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "category_id" uuid NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_invoices_category') THEN
          ALTER TABLE "erp_invoices" ADD CONSTRAINT "FK_erp_invoices_category" FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_invoices_category_id" ON "erp_invoices" ("category_id");
    `);

    // 3. Add category_id to erp_bank_transactions
    await queryRunner.query(`
      ALTER TABLE "erp_bank_transactions" ADD COLUMN IF NOT EXISTS "category_id" uuid NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_bank_transactions_category') THEN
          ALTER TABLE "erp_bank_transactions" ADD CONSTRAINT "FK_erp_bank_transactions_category" FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_bank_transactions_category_id" ON "erp_bank_transactions" ("category_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP CONSTRAINT IF EXISTS "FK_erp_bank_transactions_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bank_transactions" DROP COLUMN IF EXISTS "category_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT IF EXISTS "FK_erp_invoices_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "category_id"`,
    );

    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_entity_attribute_values"`,
    );
  }
}
