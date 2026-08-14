import { MigrationInterface, QueryRunner } from 'typeorm';

export class VinfastPartsSchema1786406852396 implements MigrationInterface {
  name = 'VinfastPartsSchema1786406852396';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "vinfast_parts_catalog" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sku" character varying(32) NOT NULL, "name" character varying(255) NOT NULL, "uom" character varying(32) NOT NULL, "is_service" boolean NOT NULL DEFAULT false, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ef411eebbae8fb679ccc8531833" UNIQUE ("sku"), CONSTRAINT "PK_7b4a855c965efd5fad142dd49d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "vinfast_parts_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "part_sku" character varying(32) NOT NULL, "invoice_item_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "direction" character varying(3) NOT NULL, "qty" numeric(12,4) NOT NULL, "unit_cost" numeric(15,2), "pre_vat_amount" numeric(15,2), "transaction_date" date NOT NULL, "license_plate" character varying(32), "settlement_order" character varying(64), "is_adjustment" boolean NOT NULL DEFAULT false, "adj_sign" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f94b18d4da0651d688bd7e23b6e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD "item_code" character varying(32)`,
    );
    // Extraneous FKs removed
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_5e3639f167165989d93fbdb0e6e" FOREIGN KEY ("part_sku") REFERENCES "vinfast_parts_catalog"("sku") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_82867af4c8456519a4bfcb536a9" FOREIGN KEY ("invoice_item_id") REFERENCES "erp_invoice_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" ADD CONSTRAINT "FK_aff5a0ae2e1992a54a34a4cf679" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT "FK_aff5a0ae2e1992a54a34a4cf679"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT "FK_82867af4c8456519a4bfcb536a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vinfast_parts_ledger" DROP CONSTRAINT "FK_5e3639f167165989d93fbdb0e6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_customs" DROP CONSTRAINT "FK_f9d14dd930586f622c4aacf45da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_lots" DROP CONSTRAINT "FK_d149543d99924a7d2b9b2285b17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP COLUMN "item_code"`,
    );
    await queryRunner.query(`DROP TABLE "vinfast_parts_ledger"`);
    await queryRunner.query(`DROP TABLE "vinfast_parts_catalog"`);
  }
}
