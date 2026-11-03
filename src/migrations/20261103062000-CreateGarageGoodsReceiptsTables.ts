import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGarageGoodsReceiptsTables20261103062000 implements MigrationInterface {
  name = 'CreateGarageGoodsReceiptsTables20261103062000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_garage_goods_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "receipt_no" character varying(128) NOT NULL,
        "receipt_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "supplier_id" uuid NULL,
        "supplier_name" character varying(255) NULL,
        "branch_id" uuid NULL,
        "branch_name" character varying(255) NULL,
        "total_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "payment_status" character varying(50) NOT NULL DEFAULT 'UNPAID',
        "remarks" text NULL,
        "created_by" uuid NULL,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_garage_goods_receipts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_erp_garage_goods_receipts_receipt_no"
      ON "erp_garage_goods_receipts" ("receipt_no")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipts_receipt_date"
      ON "erp_garage_goods_receipts" ("receipt_date")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipts_status"
      ON "erp_garage_goods_receipts" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipts_supplier_id"
      ON "erp_garage_goods_receipts" ("supplier_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipts_branch_id"
      ON "erp_garage_goods_receipts" ("branch_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipts_is_deleted"
      ON "erp_garage_goods_receipts" ("is_deleted")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_garage_goods_receipt_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "garage_goods_receipt_id" uuid NOT NULL,
        "line_no" integer NOT NULL,
        "item_code" character varying(128) NULL,
        "item_name" character varying(255) NOT NULL,
        "unit" character varying(50) NOT NULL DEFAULT 'Cái',
        "qty_received" numeric(18,3) NOT NULL,
        "unit_cost" numeric(18,2) NOT NULL DEFAULT 0,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "notes" text NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_garage_goods_receipt_lines_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_erp_garage_goods_receipt_lines_receipt_id" FOREIGN KEY ("garage_goods_receipt_id")
          REFERENCES "erp_garage_goods_receipts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipt_lines_receipt_id"
      ON "erp_garage_goods_receipt_lines" ("garage_goods_receipt_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipt_lines_item_code"
      ON "erp_garage_goods_receipt_lines" ("item_code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_garage_inventory_balances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "branch_id" uuid NULL,
        "item_code" character varying(128) NOT NULL,
        "item_name" character varying(255) NOT NULL,
        "unit" character varying(50) NOT NULL DEFAULT 'Cái',
        "qty_on_hand" numeric(18,3) NOT NULL DEFAULT 0,
        "avg_cost" numeric(18,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_garage_inventory_balances_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_inventory_balances_branch_id"
      ON "erp_garage_inventory_balances" ("branch_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_inventory_balances_item_code"
      ON "erp_garage_inventory_balances" ("item_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_garage_inventory_balances"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_garage_goods_receipt_lines"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_garage_goods_receipts"`);
  }
}
