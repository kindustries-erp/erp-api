import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tách V1 / V2 của nhật ký kiểm toán: V1 ghi lại vào `erp_audit_logs`, V2 chỉ ghi `audit_logs`.
 *
 * Từ lúc cutover (migration 20261115140000) đến khi tách, caller V1 (auth v1, users-admin,
 * garage-cashflow, interceptor route ngoài `/api/v2`) đã ghi nhầm vào `audit_logs`. Migration này
 * copy các dòng đó ngược về `erp_audit_logs` để màn hình Nhật ký V1 không mất dữ liệu.
 *
 * Dòng thuộc V1 = không có route `/api/v2/` VÀ `entity_type` khác `users_management`
 * (caller V2 duy nhất không có route là `users-management` và `auth-sessions`, cùng ghi
 * `users_management`).
 *
 * - `id` giữ nguyên; `ON CONFLICT (id) DO NOTHING` nên chạy lại an toàn.
 * - Chỉ INSERT vào `erp_audit_logs`; không sửa hay xóa `audit_logs`.
 * - `down()` không xóa dữ liệu (không phân biệt được dòng đã copy với dòng V1 ghi bình thường).
 */
export class RestoreV1AuditLogs20261115160000 implements MigrationInterface {
  name = 'RestoreV1AuditLogs20261115160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "erp_audit_logs" (
        "id", "request_id", "actor_user_id", "actor_email", "actor_employee_id",
        "action_type", "module", "entity_type", "entity_id", "route", "http_method",
        "status", "message", "ui_screen", "ui_action",
        "before_snapshot", "after_snapshot", "error_snapshot",
        "ip_address", "user_agent", "created_at"
      )
      SELECT
        "id", "request_id", "actor_user_id", "actor_email", "actor_employee_id",
        "action_type", "module", "entity_type", "entity_id", "route", "http_method",
        "status", "message", "ui_screen", "ui_action",
        "before_snapshot", "after_snapshot", "error_snapshot",
        "ip_address", "user_agent", "created_at"
      FROM "audit_logs"
      WHERE COALESCE("route", '') NOT LIKE '%/api/v2/%'
        AND COALESCE("entity_type", '') <> 'users_management'
      ON CONFLICT ("id") DO NOTHING`);
  }

  public async down(): Promise<void> {
    // Cố ý để trống: dữ liệu audit chỉ được thêm, không xóa khi rollback.
  }
}
