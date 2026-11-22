import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phiếu kho Garage mới (nhập, xuất, điều chỉnh): header và dòng cho từng loại.
 * Chỉ thêm bảng mới. Bảng nhập garage cũ (garage_goods_receipts, erp_*) không bị đụng tới.
 */
export class CreateGarageStockVouchers20261106130100 implements MigrationInterface {
  name = 'CreateGarageStockVouchers20261106130100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const kind of ['receipts', 'issues', 'adjustments']) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "garage_stock_${kind}" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "voucher_no" varchar(64) NOT NULL,
          "voucher_date" timestamptz NOT NULL,
          "branch_id" uuid NULL,
          "partner_name" varchar(255) NULL,
          "remarks" text NULL,
          "total_amount" numeric(18,2) NOT NULL DEFAULT 0,
          "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
          "is_deleted" boolean NOT NULL DEFAULT false,
          "created_by" uuid NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_garage_stock_${kind}_voucher_no" ON "garage_stock_${kind}" ("voucher_no")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "ix_garage_stock_${kind}_branch" ON "garage_stock_${kind}" ("branch_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "garage_stock_${kind.replace(/s$/, '')}_lines" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "voucher_id" uuid NOT NULL REFERENCES "garage_stock_${kind}"("id") ON DELETE CASCADE,
          "line_no" integer NOT NULL,
          "item_code" varchar(128) NOT NULL,
          "item_name" varchar(255) NOT NULL,
          "unit" varchar(50) NOT NULL DEFAULT 'Cái',
          "qty" numeric(18,3) NOT NULL,
          "unit_cost" numeric(18,2) NULL,
          "amount" numeric(18,2) NOT NULL DEFAULT 0,
          "direction" varchar(3) NOT NULL,
          "notes" text NULL
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "ix_garage_stock_${kind.replace(/s$/, '')}_lines_voucher" ON "garage_stock_${kind.replace(/s$/, '')}_lines" ("voucher_id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const kind of ['adjustments', 'issues', 'receipts']) {
      const single = kind.replace(/s$/, '');
      await queryRunner.query(
        `DROP TABLE IF EXISTS "garage_stock_${single}_lines"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "garage_stock_${kind}"`);
    }
  }
}
