import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreUserTablePreferences20261025100000 implements MigrationInterface {
  name = 'CreateCoreUserTablePreferences20261025100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "core_user_table_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "table_id" character varying(200) NOT NULL,
        "columns" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "views" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_core_user_table_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_core_user_table_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_core_user_table_preferences_user_table"
      ON "core_user_table_preferences" ("user_id", "table_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_core_user_table_preferences_user_table"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core_user_table_preferences"`,
    );
  }
}
