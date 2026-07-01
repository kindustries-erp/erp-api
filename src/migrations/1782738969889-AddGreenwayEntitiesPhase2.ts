import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGreenwayEntitiesPhase21782738969889 implements MigrationInterface {
  name = 'AddGreenwayEntitiesPhase21782738969889';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "gw_receivables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "code" character varying(100), "name" character varying(255), "total_amount" numeric(18,2), "paid_amount" numeric(18,2), "branch_external_id" character varying(100), "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8b39693cc7a80e7f1472d46658" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5ec1d130bc48f433184606f838" ON "gw_receivables" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6d16c4a07d47e259eac0be5907" ON "gw_receivables" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "gw_payables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "code" character varying(100), "name" character varying(255), "total_amount" numeric(18,2), "paid_amount" numeric(18,2), "branch_external_id" character varying(100), "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6df516492a9aa9780c654c3c681" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b13a47e28e29e30989b94ae521" ON "gw_payables" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c5c97ed8b4f17b17a30f129eee" ON "gw_payables" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "gw_case_services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "case_external_id" character varying(100) NOT NULL, "service_code" character varying(100), "service_name" character varying(255), "quantity" numeric(18,4), "price" numeric(18,2), "total_amount" numeric(18,2), "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9db446d98f92d72dd0d8190c68b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_daa1e4257265e091d67bf1d377" ON "gw_case_services" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_24711bd00bcd0a146657e82ad1" ON "gw_case_services" ("case_external_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "gw_case_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "case_external_id" character varying(100) NOT NULL, "payment_method" character varying(100), "amount" numeric(18,2), "payment_date" TIMESTAMP, "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dcee4fd74be4b5caf0ef62fa020" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6bddf274bd277a78fa82dad606" ON "gw_case_payments" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2fd40b61703de72d00909b21db" ON "gw_case_payments" ("case_external_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2fd40b61703de72d00909b21db"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bddf274bd277a78fa82dad606"`,
    );
    await queryRunner.query(`DROP TABLE "gw_case_payments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_24711bd00bcd0a146657e82ad1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_daa1e4257265e091d67bf1d377"`,
    );
    await queryRunner.query(`DROP TABLE "gw_case_services"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c5c97ed8b4f17b17a30f129eee"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b13a47e28e29e30989b94ae521"`,
    );
    await queryRunner.query(`DROP TABLE "gw_payables"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6d16c4a07d47e259eac0be5907"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ec1d130bc48f433184606f838"`,
    );
    await queryRunner.query(`DROP TABLE "gw_receivables"`);
  }
}
