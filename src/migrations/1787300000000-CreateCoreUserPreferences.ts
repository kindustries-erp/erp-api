import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreUserPreferences1787300000000 implements MigrationInterface {
  name = 'CreateCoreUserPreferences1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core_user_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "theme" character varying(50) NOT NULL DEFAULT 'classic',
        "language" character varying(10) NOT NULL DEFAULT 'vi',
        "table_configs" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "ui_configs" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_core_user_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_core_user_preferences_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_core_user_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_core_user_preferences_user_id"
      ON "core_user_preferences" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_core_user_preferences_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "core_user_preferences"`);
  }
}
