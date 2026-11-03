import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2 cờ exclude_from_reports / exclude_from_debt là field dựng sẵn của GARAGE_CASE, nguồn duy nhất là cột kgara_cases.
 * Xóa cứng 2 def hệ thống cũ (đã không còn giá trị EAV tham chiếu, xem migration 20261014130000).
 */
export class RemoveGarageCaseExcludeFlagDefs20261019100000 implements MigrationInterface {
  name = 'RemoveGarageCaseExcludeFlagDefs20261019100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "erp_module_attribute_defs"
      WHERE "module_key_global" = 'GARAGE_CASE'
        AND "is_global" = true
        AND "code" IN ('exclude_from_reports', 'exclude_from_debt');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Khôi phục đúng định nghĩa seed ở migration 1789500000000 (chỉ def, không khôi phục giá trị EAV).
    await queryRunner.query(`
      INSERT INTO "erp_module_attribute_defs" (
        "id", "is_global", "module_key_global", "code", "name", "name_en",
        "field_type", "sort_order", "is_required", "is_active", "is_system", "is_deleted", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(), true, 'GARAGE_CASE', 'exclude_from_reports', 'Không tính vào báo cáo', 'Exclude from Reports',
        'CHECKBOX', 10, false, true, true, false, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "erp_module_attribute_defs"
        WHERE "is_global" = true AND "module_key_global" = 'GARAGE_CASE' AND "code" = 'exclude_from_reports'
      );

      INSERT INTO "erp_module_attribute_defs" (
        "id", "is_global", "module_key_global", "code", "name", "name_en",
        "field_type", "sort_order", "is_required", "is_active", "is_system", "is_deleted", "created_at", "updated_at"
      )
      SELECT
        gen_random_uuid(), true, 'GARAGE_CASE', 'exclude_from_debt', 'Không tính công nợ doanh thu / chi phí', 'Exclude from Receivables & Payables',
        'CHECKBOX', 20, false, true, true, false, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "erp_module_attribute_defs"
        WHERE "is_global" = true AND "module_key_global" = 'GARAGE_CASE' AND "code" = 'exclude_from_debt'
      );
    `);
  }
}
