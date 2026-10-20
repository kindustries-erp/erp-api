import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phiếu có classification nhưng category_id NULL (dữ liệu cũ/sync trước khi có category) khiến combobox
 * "Phân loại" ở drawer trống. Gán category_id theo classification (OJ nhận diện theo semantic_key).
 * down(): không hoàn tác (không phân biệt được dòng đã backfill); backup id nằm ở file CSV ngoài repo.
 */
export class BackfillGarageCaseCategoryFromClassification20261014150000 implements MigrationInterface {
  name = 'BackfillGarageCaseCategoryFromClassification20261014150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cases" c
      SET "category_id" = cat."id"
      FROM "erp_module_categories" cat
      WHERE c."category_id" IS NULL
        AND c."classification" IS NOT NULL
        AND cat."module_key" = 'GARAGE_CASE'
        AND cat."is_deleted" = false
        AND (
          cat."code" = c."classification"
          OR (c."classification" IN ('OJ', 'OJ_NGOAI') AND cat."semantic_key" = 'OJ')
        );
    `);
  }

  public async down(): Promise<void> {
    // Không hoàn tác dữ liệu backfill.
  }
}
