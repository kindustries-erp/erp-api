import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bổ sung cho `KgaraBranchToPhoQuang20261126110000`: `cases_garage.source_snapshot.branchId` (giá trị gốc để
 * "Về trạng thái KGara") vẫn trỏ GR/GN đã xóa mềm. Đổi sang PQ. Tìm chi nhánh theo mã; không có PQ thì bỏ qua.
 * Giá trị cũ lưu ở `_mig_kgara_branch_snapshot_backup` để `down()` hoàn lại.
 */
export class KgaraBranchSnapshotToPhoQuang20261126120000 implements MigrationInterface {
  name = 'KgaraBranchSnapshotToPhoQuang20261126120000';

  private static readonly BACKUP = '_mig_kgara_branch_snapshot_backup';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const B = KgaraBranchSnapshotToPhoQuang20261126120000.BACKUP;
    const ctx = `
      WITH pq AS (SELECT "id"::text AS "id" FROM "branches_management" WHERE "code" = 'PQ' AND "is_deleted" = false LIMIT 1),
           old AS (SELECT "id"::text AS "id" FROM "branches_management" WHERE "code" IN ('GR', 'GN'))`;
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "${B}" ("id" uuid PRIMARY KEY, "old_branch_id" text)`,
    );
    await queryRunner.query(
      `${ctx}
       INSERT INTO "${B}" ("id", "old_branch_id")
       SELECT c."id", c."source_snapshot"->>'branchId' FROM "cases_garage" c
       WHERE c."source_snapshot"->>'branchId' IN (SELECT "id" FROM old) AND EXISTS (SELECT 1 FROM pq)
       ON CONFLICT ("id") DO NOTHING`,
    );
    await queryRunner.query(
      `${ctx}
       UPDATE "cases_garage" c
       SET "source_snapshot" = c."source_snapshot" || jsonb_build_object('branchId', (SELECT "id" FROM pq))
       WHERE c."source_snapshot"->>'branchId' IN (SELECT "id" FROM old) AND EXISTS (SELECT 1 FROM pq)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const B = KgaraBranchSnapshotToPhoQuang20261126120000.BACKUP;
    const exists = (await queryRunner.query(
      `SELECT to_regclass('public.${B}') IS NOT NULL AS "ok"`,
    )) as Array<{ ok: boolean }>;
    if (!exists[0]?.ok) return;
    await queryRunner.query(
      `UPDATE "cases_garage" c
       SET "source_snapshot" = c."source_snapshot" || jsonb_build_object('branchId', k."old_branch_id")
       FROM "${B}" k WHERE k."id" = c."id"`,
    );
    await queryRunner.query(`DROP TABLE "${B}"`);
  }
}
