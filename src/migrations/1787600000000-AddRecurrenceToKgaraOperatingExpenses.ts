import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecurrenceToKgaraOperatingExpenses1787600000000 implements MigrationInterface {
  name = 'AddRecurrenceToKgaraOperatingExpenses1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_operating_expenses"
      ADD COLUMN IF NOT EXISTS "recurrence_type" character varying(20),
      ADD COLUMN IF NOT EXISTS "recurrence_until_year" smallint,
      ADD COLUMN IF NOT EXISTS "recurrence_until_month" smallint,
      ADD COLUMN IF NOT EXISTS "recurrence_anchor_id" uuid;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_kgara_opex_recurrence_anchor"
      ON "kgara_operating_expenses" ("recurrence_anchor_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_kgara_opex_recurrence_anchor";
    `);

    await queryRunner.query(`
      ALTER TABLE "kgara_operating_expenses"
      DROP COLUMN IF EXISTS "recurrence_anchor_id",
      DROP COLUMN IF EXISTS "recurrence_until_month",
      DROP COLUMN IF EXISTS "recurrence_until_year",
      DROP COLUMN IF EXISTS "recurrence_type";
    `);
  }
}
