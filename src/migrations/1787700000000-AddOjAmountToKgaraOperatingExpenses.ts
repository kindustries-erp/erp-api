import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOjAmountToKgaraOperatingExpenses1787700000000 implements MigrationInterface {
  name = 'AddOjAmountToKgaraOperatingExpenses1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_operating_expenses"
      ADD COLUMN IF NOT EXISTS "oj_amount" numeric(18, 2) DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_operating_expenses"
      DROP COLUMN IF EXISTS "oj_amount";
    `);
  }
}
