import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoSync17821099701782109970576 implements MigrationInterface {
  name = 'AutoSync17821099701782109970576';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_inventory_items_production_order_id"`,
    );
    await queryRunner.query(
      `CREATE TABLE "company_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_name" character varying(255) NOT NULL, "tax_code" character varying(50), "address" text, "mobi_phone" character varying(50), "email" character varying(255), "note" text, "logo" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_058d1cfee40e5e53412ed7484b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "production_order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" SET DEFAULT 'NONE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "production_order_id" uuid`,
    );
    await queryRunner.query(`DROP TABLE "company_profile"`);
    await queryRunner.query(
      `CREATE INDEX "idx_erp_inventory_items_production_order_id" ON "erp_inventory_items" ("production_order_id") `,
    );
  }
}
