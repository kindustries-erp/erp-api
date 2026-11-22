import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đổi bảng thông báo v2 từ `notifications_core` sang `notifications_inbox`.
 * Bảng thuộc module `notifications-inbox`; hậu tố `_core` không dùng cho bảng.
 * - Chỉ đổi tên, không đổi dữ liệu. Idempotent: bỏ qua nếu bảng cũ không tồn tại.
 * - Đổi luôn PK, FK và index để tên khớp với entity mới.
 */
export class RenameNotificationsCoreToInbox20261109150000 implements MigrationInterface {
  name = 'RenameNotificationsCoreToInbox20261109150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.renameTable(
      queryRunner,
      'notifications_core',
      'notifications_inbox',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.renameTable(
      queryRunner,
      'notifications_inbox',
      'notifications_core',
    );
  }

  private async renameTable(
    queryRunner: QueryRunner,
    fromTable: string,
    toTable: string,
  ): Promise<void> {
    const [{ src }] = await queryRunner.query(
      `SELECT to_regclass($1)::text AS src`,
      [`public.${fromTable}`],
    );
    if (!src) return;

    const [{ dst }] = await queryRunner.query(
      `SELECT to_regclass($1)::text AS dst`,
      [`public.${toTable}`],
    );
    if (dst) {
      throw new Error(
        `Bảng ${toTable} đã tồn tại, không thể đổi tên từ ${fromTable}`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "${fromTable}" RENAME TO "${toTable}"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_${fromTable}_user_list" RENAME TO "IDX_${toTable}_user_list"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${toTable}" RENAME CONSTRAINT "PK_${fromTable}_id" TO "PK_${toTable}_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${toTable}" RENAME CONSTRAINT "FK_${fromTable}_user_id" TO "FK_${toTable}_user_id"`,
    );
  }
}
