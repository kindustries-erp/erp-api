import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGreenwayEntities1782736612037 implements MigrationInterface {
  name = 'AddGreenwayEntities1782736612037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "gw_auth" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "access_token" text, "refresh_token" text, "token_expires" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b0855b30892f9e86327240f279e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "gw_branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "code" character varying(100), "name" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_adcf4bc4e6b988c3393bf3e6b51" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_65c0a6c2a3fdba456390a572a1" ON "gw_branches" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "gw_cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "case_code" character varying(100), "case_name" character varying(255), "status_code" integer, "status_name" character varying(100), "total_amount" numeric(18,2), "paid_amount" numeric(18,2), "branch_external_id" character varying(100), "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf772bb110d52468080be2bc329" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c9d971c4ccdea07309364ac425" ON "gw_cases" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daf2d21fec1b2578041a9a6d22" ON "gw_cases" ("branch_external_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_daf2d21fec1b2578041a9a6d22"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c9d971c4ccdea07309364ac425"`,
    );
    await queryRunner.query(`DROP TABLE "gw_cases"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65c0a6c2a3fdba456390a572a1"`,
    );
    await queryRunner.query(`DROP TABLE "gw_branches"`);
    await queryRunner.query(`DROP TABLE "gw_auth"`);
  }
}
