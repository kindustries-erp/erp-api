import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * GR và GN là tài khoản KGara (MAIN, OJ), không phải chi nhánh ERP. Xe KGara thuộc chi nhánh ERP Phổ Quang (PQ):
 * - trỏ liên kết KGara (`branches_management_external_links`) từ GR/GN sang PQ;
 * - chuyển `branch_id` của xe và công nợ garage từ GR/GN sang PQ;
 * - xóa mềm GR, GN trong `branches_management`.
 * Tìm chi nhánh theo mã, không theo id. DB không có PQ hoặc không có GR/GN thì không đổi gì.
 * Dòng đã đổi lưu ở bảng tạm `_mig_kgara_branch_pq_backup` để `down()` hoàn lại đúng.
 */
export class KgaraBranchToPhoQuang20261126110000 implements MigrationInterface {
  name = 'KgaraBranchToPhoQuang20261126110000';

  private static readonly BACKUP = '_mig_kgara_branch_pq_backup';
  private static readonly TABLES = [
    'cases_garage',
    'debts_garage',
    'debt_allocations_garage',
    'branches_management_external_links',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const B = KgaraBranchToPhoQuang20261126110000.BACKUP;
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${B}" ("tbl" varchar(100) NOT NULL, "id" uuid NOT NULL, "old_branch_id" uuid, "old_is_active" boolean, "old_is_deleted" boolean)`,
    );
    const ctx = `
      WITH pq AS (SELECT "id" FROM "branches_management" WHERE "code" = 'PQ' AND "is_deleted" = false LIMIT 1),
           old AS (SELECT "id" FROM "branches_management" WHERE "code" IN ('GR', 'GN') AND "is_deleted" = false)`;

    for (const t of KgaraBranchToPhoQuang20261126110000.TABLES) {
      await queryRunner.query(
        `${ctx}
         INSERT INTO "${B}" ("tbl", "id", "old_branch_id")
         SELECT '${t}', x."id", x."branch_id" FROM "${t}" x
         WHERE x."branch_id" IN (SELECT "id" FROM old) AND EXISTS (SELECT 1 FROM pq)`,
      );
      await queryRunner.query(
        `${ctx}
         UPDATE "${t}" x SET "branch_id" = (SELECT "id" FROM pq)
         WHERE x."branch_id" IN (SELECT "id" FROM old) AND EXISTS (SELECT 1 FROM pq)`,
      );
    }

    await queryRunner.query(
      `${ctx}
       INSERT INTO "${B}" ("tbl", "id", "old_is_active", "old_is_deleted")
       SELECT 'branches_management', b."id", b."is_active", b."is_deleted" FROM "branches_management" b
       WHERE b."id" IN (SELECT "id" FROM old) AND EXISTS (SELECT 1 FROM pq)`,
    );
    await queryRunner.query(
      `${ctx}
       UPDATE "branches_management" b SET "is_deleted" = true, "is_active" = false, "updated_at" = now()
       WHERE b."id" IN (SELECT "id" FROM old) AND EXISTS (SELECT 1 FROM pq)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const B = KgaraBranchToPhoQuang20261126110000.BACKUP;
    const exists = (await queryRunner.query(
      `SELECT to_regclass('public.${B}') IS NOT NULL AS "ok"`,
    )) as Array<{ ok: boolean }>;
    if (!exists[0]?.ok) return;

    await queryRunner.query(
      `UPDATE "branches_management" b SET "is_active" = k."old_is_active", "is_deleted" = k."old_is_deleted", "updated_at" = now()
       FROM "${B}" k WHERE k."tbl" = 'branches_management' AND k."id" = b."id"`,
    );
    for (const t of KgaraBranchToPhoQuang20261126110000.TABLES) {
      await queryRunner.query(
        `UPDATE "${t}" x SET "branch_id" = k."old_branch_id"
         FROM "${B}" k WHERE k."tbl" = '${t}' AND k."id" = x."id"`,
      );
    }
    await queryRunner.query(`DROP TABLE "${B}"`);
  }
}
