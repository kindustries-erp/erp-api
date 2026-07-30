import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSinvoiceTables1785329656253 implements MigrationInterface {
  name = 'AddSinvoiceTables1785329656253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sinvoice_drafts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "document_no" character varying(64), "supplier_tax_code" character varying(32), "buyer_name" character varying(255), "buyer_tax_code" character varying(64), "buyer_address" text, "buyer_email" character varying(255), "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "vat_amount" numeric(18,2) NOT NULL DEFAULT '0', "currency_code" character varying(8) DEFAULT 'VND', "description" text, "status" character varying(32) NOT NULL DEFAULT 'DRAFT', "lines" jsonb, "request_payload" jsonb, "response_payload" jsonb, "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2149b9579f8c29b3175485a655b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b40ffec16fdf52c5874ea74f4b" ON "sinvoice_drafts" ("document_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8f054ce7c68f6a6f4847445e3d" ON "sinvoice_drafts" ("status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sinvoice_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "supplier_tax_code" character varying(32), "username" character varying(255), "password" character varying(255), "app_key" character varying(255), "api_url" character varying(500) DEFAULT 'https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/', "environment" character varying(32) DEFAULT 'production', "is_active" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_68fe0c7b56fd9943420da539999" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sinvoice_configs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8f054ce7c68f6a6f4847445e3d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b40ffec16fdf52c5874ea74f4b"`,
    );
    await queryRunner.query(`DROP TABLE "sinvoice_drafts"`);
  }
}
