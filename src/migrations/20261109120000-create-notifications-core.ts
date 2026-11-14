import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsCore20261109120000 implements MigrationInterface {
  name = 'CreateNotificationsCore20261109120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications_core" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "type" character varying(20) NOT NULL DEFAULT 'INFO',
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "target_module" character varying(50),
        "target_id" character varying(100),
        "action" character varying(30),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_core_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_core_user_id" FOREIGN KEY ("user_id")
          REFERENCES "core_users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_core_user_list"
      ON "notifications_core" ("user_id", "is_deleted", "is_read", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_core_user_list"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications_core"`);
  }
}
