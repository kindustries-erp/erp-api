import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreNotifications20260713000000 implements MigrationInterface {
  name = 'CreateCoreNotifications20260713000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "type" character varying(20) NOT NULL DEFAULT 'INFO',
        "is_read" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_core_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "core_notifications"
      ADD CONSTRAINT "FK_core_notifications_user_id" FOREIGN KEY ("user_id")
      REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core_notifications" DROP CONSTRAINT "FK_core_notifications_user_id"
    `);
    await queryRunner.query(`DROP TABLE "core_notifications"`);
  }
}
