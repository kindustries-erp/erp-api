import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBomConfigTables1787000000000 implements MigrationInterface {
  name = 'CreateBomConfigTables1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_bom_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_bom_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_bom_categories_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_bom_attribute_defs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL,
        "code" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "field_type" character varying(50) NOT NULL DEFAULT 'TEXT',
        "options" jsonb,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_required" boolean NOT NULL DEFAULT false,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_bom_attribute_defs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_bom_attribute_defs_category_code" UNIQUE ("category_id", "code"),
        CONSTRAINT "FK_erp_bom_attribute_defs_category" FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_bom_attribute_values" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "bom_id" uuid NOT NULL,
        "attr_def_id" uuid NOT NULL,
        "value_text" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_bom_attribute_values" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_erp_bom_attribute_values_bom_attr" UNIQUE ("bom_id", "attr_def_id"),
        CONSTRAINT "FK_erp_bom_attribute_values_bom" FOREIGN KEY ("bom_id") REFERENCES "erp_boms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_erp_bom_attribute_values_attr_def" FOREIGN KEY ("attr_def_id") REFERENCES "erp_bom_attribute_defs"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_bom_attribute_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_bom_attribute_defs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_bom_categories"`);
  }
}
