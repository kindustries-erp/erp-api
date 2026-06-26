import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackingSchemaRefactor1782442364064 implements MigrationInterface {
  name = 'TrackingSchemaRefactor1782442364064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing FKs that will be recreated
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_erp_inv_items_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_erp_inv_items_item_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP CONSTRAINT "FK_erp_bom_lines_uom"`,
    );

    // 2. Create new tables
    await queryRunner.query(
      `CREATE TABLE "erp_tracking_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(50) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_98ffd6d7c7afd236ddc003ff4b5" UNIQUE ("code"), CONSTRAINT "PK_485b1a69023518b968d8cb1cf2a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_inventory_tracking_serials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "item_id" uuid, "serial_no" character varying(255) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'IN_STOCK', "vin_id" uuid, "custom_id" uuid, "receipt_line_id" uuid, "sales_order_line_id" uuid, "goods_issue_line_id" uuid, "production_order_id" uuid, "lot_no" character varying(255), "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bb2aa836a5cbb58fd9a04ea1568" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_inventory_tracking_lots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "item_id" uuid, "lot_code" character varying(100) NOT NULL, "received_qty" numeric(18,3) NOT NULL DEFAULT '0', "issued_qty" numeric(18,3) NOT NULL DEFAULT '0', "expiry_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ac417d0dcf1c901c786426dafbc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_inventory_tracking_customs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "item_id" uuid, "status" character varying(50) NOT NULL DEFAULT 'IN_STOCK', "custom_metadata" jsonb, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3f7de09c5a90db27b67a21e2671" PRIMARY KEY ("id"))`,
    );

    // 3. Add new columns
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "tracking_policy_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "tracking_category_id" uuid`,
    );
    // Add vin_no as nullable first
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "vin_no" character varying(255)`,
    );

    // ── DATA MIGRATION ─────────────────────────────────────────────────────────

    // Seed default tracking policies
    await queryRunner.query(`
          INSERT INTO "erp_tracking_policies" ("id", "code", "name", "description", "is_active", "is_deleted")
          VALUES
            (uuid_generate_v4(), 'NONE',    'Không theo dõi',         'Chỉ theo dõi số lượng tổng, không track từng đơn vị', true, false),
            (uuid_generate_v4(), 'SERIAL',  'Theo Serial Number',      'Theo dõi đích danh từng đơn vị bằng serial number', true, false),
            (uuid_generate_v4(), 'LOT',     'Theo Lô (Lot)',           'Theo dõi theo lô hàng, có hạn sử dụng', true, false),
            (uuid_generate_v4(), 'VEHICLE', 'Theo Xe (VIN + Số máy)', 'Theo dõi từng chiếc xe bằng VIN và số máy', true, false),
            (uuid_generate_v4(), 'CUSTOM',  'Tùy chỉnh (Custom)',      'Theo dõi với các thuộc tính tự định nghĩa qua JSON', true, false)
          ON CONFLICT ("code") DO NOTHING
        `);

    // Migrate vin data
    await queryRunner.query(`
          UPDATE "erp_vehicles" SET "vin_no" = "vin"
        `);

    // Copy data from old erp_inventory_serials -> erp_inventory_tracking_serials
    await queryRunner.query(`
          INSERT INTO "erp_inventory_tracking_serials"
            ("id", "item_id", "serial_no", "status", "vin_id", "custom_id",
             "receipt_line_id", "sales_order_line_id", "goods_issue_line_id",
             "production_order_id", "lot_no", "notes", "created_at", "updated_at")
          SELECT
            "id", "item_id", "serial_no", "status", "vin_id", NULL,
            "receipt_line_id", "sales_order_line_id", "goods_issue_line_id",
            "production_order_id", "lot_no", "notes", "created_at", "updated_at"
          FROM "erp_inventory_serials"
          ON CONFLICT DO NOTHING
        `);

    // Copy data from old erp_inventory_lots -> erp_inventory_tracking_lots
    await queryRunner.query(`
          INSERT INTO "erp_inventory_tracking_lots"
            ("id", "item_id", "lot_code", "received_qty", "issued_qty", "expiry_date", "created_at", "updated_at")
          SELECT
            "id", "item_id", "lot_code", "received_qty", "issued_qty", "expiry_date", "created_at", "updated_at"
          FROM "erp_inventory_lots"
          ON CONFLICT DO NOTHING
        `);

    // Migrate tracking_policy enum -> tracking_policy_id FK
    await queryRunner.query(`
          UPDATE "erp_inventory_items" i
          SET "tracking_policy_id" = tp."id"
          FROM "erp_tracking_policies" tp
          WHERE tp."code" = i."tracking_policy"
        `);

    // Migrate tracking_category_key -> tracking_category_id FK
    await queryRunner.query(`
          UPDATE "erp_inventory_items" i
          SET "tracking_category_id" = tc."id"
          FROM "erp_tracking_categories" tc
          WHERE tc."code" = i."tracking_category_key"
            AND i."tracking_category_key" IS NOT NULL
        `);

    // ── END DATA MIGRATION ─────────────────────────────────────────────────────

    // 4. Drop old columns
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "tracking_category_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "tracking_policy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP COLUMN "frame_no"`,
    );
    await queryRunner.query(`ALTER TABLE "erp_vehicles" DROP COLUMN "vin"`);

    // 5. Finalize constraints and NOT NULLs
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ALTER COLUMN "vin_no" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD CONSTRAINT "UQ_be67e7850cd0686da18b455d9d4" UNIQUE ("vin_no")`,
    );

    // Provide default values for columns that are becoming NOT NULL
    await queryRunner.query(`
      UPDATE "erp_inventory_items"
      SET "uom_id" = (SELECT "id" FROM "erp_uoms" LIMIT 1)
      WHERE "uom_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "erp_inventory_items"
      SET "item_type_id" = (SELECT "id" FROM "erp_item_types" LIMIT 1)
      WHERE "item_type_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "erp_bom_lines"
      SET "uom_id" = (SELECT "id" FROM "erp_uoms" LIMIT 1)
      WHERE "uom_id" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "uom_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "item_type_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ALTER COLUMN "uom_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD CONSTRAINT "UQ_e2661397651649646d2c49978e5" UNIQUE ("engine_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_4894e7c3469a56b02f7255d0652" FOREIGN KEY ("uom_id") REFERENCES "erp_uoms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_a2ee49096232130daa91db7283f" FOREIGN KEY ("item_type_id") REFERENCES "erp_item_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_df0e1dca211ccc1ee936451aea0" FOREIGN KEY ("tracking_policy_id") REFERENCES "erp_tracking_policies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_b4cd2efbd0e696c3162ee46037e" FOREIGN KEY ("tracking_category_id") REFERENCES "erp_tracking_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD CONSTRAINT "FK_408b145acc3278f7cdf08408261" FOREIGN KEY ("uom_id") REFERENCES "erp_uoms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP CONSTRAINT "FK_408b145acc3278f7cdf08408261"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_b4cd2efbd0e696c3162ee46037e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_df0e1dca211ccc1ee936451aea0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_a2ee49096232130daa91db7283f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "FK_4894e7c3469a56b02f7255d0652"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP CONSTRAINT "UQ_e2661397651649646d2c49978e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ALTER COLUMN "uom_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "item_type_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "uom_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" DROP CONSTRAINT "UQ_be67e7850cd0686da18b455d9d4"`,
    );
    await queryRunner.query(`ALTER TABLE "erp_vehicles" DROP COLUMN "vin_no"`);
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "tracking_category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "tracking_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "vin" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_vehicles" ADD "frame_no" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "tracking_policy" character varying(20) NOT NULL DEFAULT 'NONE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "tracking_category_key" character varying(100)`,
    );
    await queryRunner.query(`DROP TABLE "erp_inventory_tracking_customs"`);
    await queryRunner.query(`DROP TABLE "erp_inventory_tracking_lots"`);
    await queryRunner.query(`DROP TABLE "erp_inventory_tracking_serials"`);
    await queryRunner.query(`DROP TABLE "erp_tracking_policies"`);
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD CONSTRAINT "FK_erp_bom_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "erp_uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_erp_inv_items_item_type" FOREIGN KEY ("item_type_id") REFERENCES "erp_item_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "FK_erp_inv_items_uom" FOREIGN KEY ("uom_id") REFERENCES "erp_uoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
  }
}
