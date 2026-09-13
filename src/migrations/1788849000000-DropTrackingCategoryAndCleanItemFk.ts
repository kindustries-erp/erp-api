import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTrackingCategoryAndCleanItemFk1788849000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign key constraint on erp_inventory_items if exists
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT IF EXISTS "FK_b4cd2efbd0e696c3162ee46037e"`,
    );

    // 2. Drop column tracking_category_id from erp_inventory_items
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN IF EXISTS "tracking_category_id"`,
    );

    // 3. Drop table erp_tracking_categories
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_tracking_categories" CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate table erp_tracking_categories
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "erp_tracking_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_010e59b3a77bf887042dfc5f3c4" UNIQUE ("code"),
        CONSTRAINT "PK_3babc5544fd8e40ceb8fd5436ed" PRIMARY KEY ("id")
      )`,
    );

    // Add back tracking_category_id column
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD COLUMN IF NOT EXISTS "tracking_category_id" uuid`,
    );

    // Add back foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_b4cd2efbd0e696c3162ee46037e" FOREIGN KEY ("tracking_category_id") REFERENCES "erp_tracking_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
