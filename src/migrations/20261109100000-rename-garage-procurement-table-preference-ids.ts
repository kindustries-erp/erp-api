import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đổi tableId cấu hình bảng garage procurement sang tên theo feature. */
const RENAMES: ReadonlyArray<readonly [from: string, to: string]> = [
  [
    'erp-garage-procurement-requests-table',
    'procurement-requests-garage-table',
  ],
  ['erp-garage-procurement-orders-table', 'procurement-orders-garage-table'],
];

/**
 * Chỉ đổi dòng của user chưa có sẵn tableId mới. Dòng cũ còn sót (do đã có
 * dòng id mới) được giữ nguyên để không vi phạm unique (user_id, table_id).
 */
async function renameTableIds(
  queryRunner: QueryRunner,
  pairs: ReadonlyArray<readonly [string, string]>,
): Promise<void> {
  for (const [from, to] of pairs) {
    await queryRunner.query(
      `
      UPDATE "core_user_table_preferences" AS t
      SET "table_id" = $2, "updated_at" = now()
      WHERE t."table_id" = $1
        AND NOT EXISTS (
          SELECT 1 FROM "core_user_table_preferences" AS x
          WHERE x."user_id" = t."user_id" AND x."table_id" = $2
        )
      `,
      [from, to],
    );
  }
}

export class RenameGarageProcurementTablePreferenceIds20261109100000 implements MigrationInterface {
  name = 'RenameGarageProcurementTablePreferenceIds20261109100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await renameTableIds(queryRunner, RENAMES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await renameTableIds(
      queryRunner,
      RENAMES.map(([from, to]) => [to, from] as const),
    );
  }
}
