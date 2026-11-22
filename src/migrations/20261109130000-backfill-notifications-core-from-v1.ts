import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Copy một lần thông báo v1 (`core_notifications`) sang `notifications_core`.
 * - Giữ nguyên id, user_id, title, message, type, is_read, created_at.
 * - `metadata` -> `extra_data` (không phải object thì `{}`).
 * - v1 không có thời điểm đọc: read_at = NULL. updated_at = created_at.
 * - Idempotent: ON CONFLICT (id) DO NOTHING, chạy lại không nhân đôi.
 * - Bỏ qua nếu một trong hai bảng không tồn tại.
 */
export class BackfillNotificationsCoreFromLegacy20261109130000 implements MigrationInterface {
  name = 'BackfillNotificationsCoreFromLegacy20261109130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ v1 }] = await queryRunner.query(
      `SELECT to_regclass('public.core_notifications')::text AS v1`,
    );
    const [{ v2 }] = await queryRunner.query(
      `SELECT to_regclass('public.notifications_core')::text AS v2`,
    );
    if (!v1 || !v2) return;

    await queryRunner.query(`
      INSERT INTO "notifications_core" (
        "id", "user_id", "title", "message", "type", "is_read", "read_at",
        "extra_data", "is_deleted", "created_at", "updated_at",
        "target_module", "target_id", "action"
      )
      SELECT
        n."id",
        n."user_id",
        n."title",
        n."message",
        n."type",
        n."is_read",
        NULL,
        CASE WHEN jsonb_typeof(n."metadata") = 'object' THEN n."metadata" ELSE '{}'::jsonb END,
        false,
        n."created_at",
        n."created_at",
        NULL,
        NULL,
        NULL
      FROM "core_notifications" n
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  /**
   * Chỉ xóa các dòng có id nằm trong bảng v1. Thông báo v2 mới tạo không bị đụng tới.
   * Lưu ý: các dòng backfill đã bị đọc/sửa sau khi chuyển cũng sẽ bị xóa.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ v1 }] = await queryRunner.query(
      `SELECT to_regclass('public.core_notifications')::text AS v1`,
    );
    const [{ v2 }] = await queryRunner.query(
      `SELECT to_regclass('public.notifications_core')::text AS v2`,
    );
    if (!v1 || !v2) return;

    await queryRunner.query(`
      DELETE FROM "notifications_core"
      WHERE "id" IN (SELECT "id" FROM "core_notifications")
    `);
  }
}
