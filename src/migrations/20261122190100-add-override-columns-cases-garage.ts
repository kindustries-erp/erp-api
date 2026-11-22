import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cơ chế override v2 trên dữ liệu sync từ KGara (xem erp-api-structure, "Mẫu override"):
 * - `source_snapshot`: giá trị mới nhất sync từ v1, khóa là tên property camelCase.
 * - `overrides`: tập khóa field đã bị v2 sửa (rỗng khi chưa sửa).
 * Backfill snapshot từ giá trị hiệu lực hiện có (chưa có override nào).
 * Bỏ khỏi snapshot: định danh/nguồn, cột hệ thống và 3 cột legacy sắp xóa.
 */
export class AddOverrideColumnsCasesGarage20261122190100 implements MigrationInterface {
  name = 'AddOverrideColumnsCasesGarage20261122190100';

  private static readonly EXCLUDED = [
    'id',
    'extra_data',
    'created_at',
    'updated_at',
    'is_deleted',
    'source_snapshot',
    'overrides',
    'origin',
    'external_id',
    'account_key',
    'branch_external_id',
    'case_id',
    'legacy_case_id',
    'legacy_service_id',
    'external_delete_count',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['cases_garage', 'case_lines_garage']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "source_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS "overrides" jsonb NOT NULL DEFAULT '{}'::jsonb
      `);
      await queryRunner.query(
        `
        UPDATE "${table}" t
        SET "source_snapshot" = COALESCE((
          SELECT jsonb_object_agg(
            split_part(e.key, '_', 1) || COALESCE((
              SELECT string_agg(initcap(p), '')
              FROM unnest((string_to_array(e.key, '_'))[2:]) AS p
            ), ''),
            e.value
          )
          FROM jsonb_each(to_jsonb(t)) e
          WHERE e.key <> ALL ($1::text[])
        ), '{}'::jsonb)
      `,
        [AddOverrideColumnsCasesGarage20261122190100.EXCLUDED],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['case_lines_garage', 'cases_garage']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          DROP COLUMN IF EXISTS "overrides",
          DROP COLUMN IF EXISTS "source_snapshot"
      `);
    }
  }
}
