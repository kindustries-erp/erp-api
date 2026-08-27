import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKgaraOperatingExpenses1787500000000 implements MigrationInterface {
  name = 'CreateKgaraOperatingExpenses1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kgara_operating_expenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "period_year" smallint NOT NULL,
        "period_month" smallint NOT NULL,
        "category_key" character varying(100) NOT NULL,
        "category_name" character varying(255) NOT NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "note" text,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kgara_operating_expenses_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kgara_opex_period"
      ON "kgara_operating_expenses" ("period_year", "period_month")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kgara_opex_category"
      ON "kgara_operating_expenses" ("category_key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_kgara_opex_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_kgara_opex_period"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "kgara_operating_expenses"`);
  }
}
