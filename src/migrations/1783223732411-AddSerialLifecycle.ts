import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSerialLifecycle1783223732411 implements MigrationInterface {
  name = 'AddSerialLifecycle1783223732411';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "erp_serial_lifecycles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "serial_id" uuid NOT NULL, "sales_order_id" uuid, "goods_issue_id" uuid, "dealer_id" uuid, "delivery_date" date, "customer_name" character varying(255), "customer_phone" character varying(255), "customer_address" text, "customer_id_number" character varying(255), "warranty_activated_at" TIMESTAMP WITH TIME ZONE, "warranty_months" integer, "warranty_end_date" date, "activation_source" character varying(50), "status" character varying(50) NOT NULL DEFAULT 'ACTIVE', "notes" text, "attributes" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f47822db663b0ad3f67b7400568" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_21b335c8f3096445e3bd03d238" ON "erp_serial_lifecycles" ("serial_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_21b335c8f3096445e3bd03d238"`,
    );
    await queryRunner.query(`DROP TABLE "erp_serial_lifecycles"`);
  }
}
