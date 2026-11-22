import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đổi khóa ngoại `notifications_inbox.user_id` từ `core_users` sang `users_management`.
 * Không đổi dữ liệu. Chặn chạy nếu còn dòng mồ côi so với `users_management`.
 */
export class NotificationsInboxFkUsersManagement20261115120000 implements MigrationInterface {
  name = 'NotificationsInboxFkUsersManagement20261115120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphans: Array<{ n: string }> = await queryRunner.query(
      `SELECT count(*)::text AS n FROM "notifications_inbox" t
       WHERE NOT EXISTS (SELECT 1 FROM "users_management" u WHERE u."id" = t."user_id")`,
    );
    if (Number(orphans[0]?.n ?? 0) > 0) {
      throw new Error(
        `notifications_inbox còn ${orphans[0].n} dòng user_id không có trong users_management`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "notifications_inbox" DROP CONSTRAINT IF EXISTS "FK_notifications_inbox_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications_inbox" ADD CONSTRAINT "FK_notifications_inbox_user_id"
       FOREIGN KEY ("user_id") REFERENCES "users_management"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications_inbox" DROP CONSTRAINT IF EXISTS "FK_notifications_inbox_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications_inbox" ADD CONSTRAINT "FK_notifications_inbox_user_id"
       FOREIGN KEY ("user_id") REFERENCES "core_users"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
