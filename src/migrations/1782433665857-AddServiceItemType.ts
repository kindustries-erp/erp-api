import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceItemType1782433665857 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            INSERT INTO "erp_item_types" ("code", "name", "description")
            VALUES ('SERVICE', 'Dịch vụ', 'Dịch vụ / Gia công phi vật lý')
            ON CONFLICT ("code") DO NOTHING;
        `);

    await queryRunner.query(`
            UPDATE "erp_inventory_items"
            SET "item_type_id" = (SELECT id FROM "erp_item_types" WHERE code = 'SERVICE')
            WHERE "sku" = 'DO2DM121';
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Fallback for DO2DM121 back to RAW if needed
    await queryRunner.query(`
            UPDATE "erp_inventory_items"
            SET "item_type_id" = (SELECT id FROM "erp_item_types" WHERE code = 'RAW')
            WHERE "sku" = 'DO2DM121';
        `);

    await queryRunner.query(`
            DELETE FROM "erp_item_types" WHERE "code" = 'SERVICE';
        `);
  }
}
