import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryAdjustments1784528545068 implements MigrationInterface {
  name = 'AddInventoryAdjustments1784528545068';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "erp_inventory_adjustments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "adjustment_no" character varying(50) NOT NULL,
                "adjustment_date" timestamp NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'DRAFT',
                "remarks" text,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now(),
                "is_deleted" boolean NOT NULL DEFAULT false,
                "created_by" uuid,
                "updated_by" uuid,
                CONSTRAINT "UQ_inventory_adjustment_no" UNIQUE ("adjustment_no"),
                CONSTRAINT "PK_inventory_adjustments" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "erp_inventory_adjustment_lines" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "adjustment_id" uuid NOT NULL,
                "item_id" uuid,
                "item_name" character varying(255),
                "qty_adjusted" numeric(15,4) NOT NULL DEFAULT '0',
                "type_adjust" character varying(20) NOT NULL,
                "unit_cost" numeric(15,2),
                CONSTRAINT "PK_inventory_adjustment_lines" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            ALTER TABLE "erp_inventory_adjustment_lines"
            ADD CONSTRAINT "FK_adjustment_lines_adjustment" FOREIGN KEY ("adjustment_id")
            REFERENCES "erp_inventory_adjustments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustment_lines" DROP CONSTRAINT "FK_adjustment_lines_adjustment"`,
    );
    await queryRunner.query(`DROP TABLE "erp_inventory_adjustment_lines"`);
    await queryRunner.query(`DROP TABLE "erp_inventory_adjustments"`);
  }
}
