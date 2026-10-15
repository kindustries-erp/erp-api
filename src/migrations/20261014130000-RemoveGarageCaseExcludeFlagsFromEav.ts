import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2 cờ exclude_from_reports / exclude_from_debt là built-in của GARAGE_CASE, nguồn duy nhất là cột kgara_cases.
 * Xóa các dòng EAV ghi đôi cũ để tránh dữ liệu cũ lệch với cột.
 */
export class RemoveGarageCaseExcludeFlagsFromEav20261014130000 implements MigrationInterface {
  name = 'RemoveGarageCaseExcludeFlagsFromEav20261014130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "erp_entity_attribute_values" v
      USING "erp_module_attribute_defs" d
      WHERE v."attr_def_id" = d."id"
        AND v."entity_type" = 'GARAGE_CASE'
        AND d."module_key_global" = 'GARAGE_CASE'
        AND d."code" IN ('exclude_from_reports', 'exclude_from_debt');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Khôi phục theo cột hiện tại cho các case đang bật cờ (xấp xỉ: các dòng 'false' cũ không phục hồi).
    await queryRunner.query(`
      INSERT INTO "erp_entity_attribute_values" ("id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at")
      SELECT gen_random_uuid(), 'GARAGE_CASE', c."id", d."id", 'true', now(), now()
      FROM "kgara_cases" c
      JOIN "erp_module_attribute_defs" d
        ON d."module_key_global" = 'GARAGE_CASE'
       AND ((d."code" = 'exclude_from_reports' AND c."exclude_from_reports" = true)
         OR (d."code" = 'exclude_from_debt' AND c."exclude_from_debt" = true))
      ON CONFLICT ("entity_type", "entity_id", "attr_def_id") DO NOTHING;
    `);
  }
}
