import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncInventoryEntities1782394490448 implements MigrationInterface {
  name = 'SyncInventoryEntities1782394490448';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_inventory_serials_item_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_inventory_serials_serial_no"`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_tracking_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(100) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_010e59b3a77bf887042dfc5f3c4" UNIQUE ("code"), CONSTRAINT "PK_3babc5544fd8e40ceb8fd5436ed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "production_order_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "lot_no" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "notes" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "lot_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_serials" DROP COLUMN "production_order_id"`,
    );
    await queryRunner.query(`DROP TABLE "erp_tracking_categories"`);
    await queryRunner.query(
      `CREATE INDEX "idx_erp_inventory_serials_serial_no" ON "erp_inventory_serials" ("serial_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_inventory_serials_item_id" ON "erp_inventory_serials" ("item_id") `,
    );
  }
}
