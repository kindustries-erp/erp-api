import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreUsers202606070001 implements MigrationInterface {
  name = 'CreateCoreUsers202606070001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'ACTIVE',
        employee_id uuid NULL,
        legacy_directus_user_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_core_users_employee_id ON core_users(employee_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_core_users_legacy_directus_user_id ON core_users(legacy_directus_user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS core_users`);
  }
}
