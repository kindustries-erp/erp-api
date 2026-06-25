import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyProfile1782109001550 implements MigrationInterface {
  name = 'CompanyProfile1782109001550';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "company_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_name" character varying(255) NOT NULL, "tax_code" character varying(50), "address" text, "mobi_phone" character varying(50), "email" character varying(255), "note" text, "logo" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_058d1cfee40e5e53412ed7484b3" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "company_profile"`);
  }
}
