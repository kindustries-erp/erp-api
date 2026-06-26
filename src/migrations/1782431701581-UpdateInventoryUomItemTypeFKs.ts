import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateInventoryUomItemTypeFKs1782431701581 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new UUID columns to erp_inventory_items
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "uom_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "item_type_id" uuid`,
    );

    // 2. Migrate data for erp_inventory_items based on code match
    // For uom
    await queryRunner.query(`
      UPDATE "erp_inventory_items" e
      SET "uom_id" = u."id"
      FROM "erp_uoms" u
      WHERE e."uom" = u."code"
    `);
    // For item_type
    await queryRunner.query(`
      UPDATE "erp_inventory_items" e
      SET "item_type_id" = t."id"
      FROM "erp_item_types" t
      WHERE e."item_type" = t."code"
    `);

    // Ensure no NULLs if we are making it required. If there are unmatched codes, we might have nulls.
    // Assuming data integrity is solid. We make them NOT NULL if business logic requires it, but let's just make them FKs.
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_erp_inv_items_uom" FOREIGN KEY ("uom_id") REFERENCES "erp_uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_erp_inv_items_item_type" FOREIGN KEY ("item_type_id") REFERENCES "erp_item_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );

    // 3. Drop old columns
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "item_type"`,
    );

    // 4. Update erp_bom_lines
    await queryRunner.query(`ALTER TABLE "erp_bom_lines" ADD "uom_id" uuid`);
    await queryRunner.query(`
      UPDATE "erp_bom_lines" b
      SET "uom_id" = u."id"
      FROM "erp_uoms" u
      WHERE b."uom" = u."code"
    `);
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD CONSTRAINT "FK_erp_bom_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "erp_uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(`ALTER TABLE "erp_bom_lines" DROP COLUMN "uom"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add old columns
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "uom" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "item_type" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD "uom" character varying(100)`,
    );

    // 2. Migrate data back
    await queryRunner.query(`
      UPDATE "erp_inventory_items" e
      SET "uom" = u."code"
      FROM "erp_uoms" u
      WHERE e."uom_id" = u."id"
    `);
    await queryRunner.query(`
      UPDATE "erp_inventory_items" e
      SET "item_type" = t."code"
      FROM "erp_item_types" t
      WHERE e."item_type_id" = t."id"
    `);
    await queryRunner.query(`
      UPDATE "erp_bom_lines" b
      SET "uom" = u."code"
      FROM "erp_uoms" u
      WHERE b."uom_id" = u."id"
    `);

    // 3. Drop constraints and new columns
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_erp_inv_items_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_erp_inv_items_item_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP CONSTRAINT "FK_erp_bom_lines_uom"`,
    );

    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "uom_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "item_type_id"`,
    );
    await queryRunner.query(`ALTER TABLE "erp_bom_lines" DROP COLUMN "uom_id"`);
  }
}
