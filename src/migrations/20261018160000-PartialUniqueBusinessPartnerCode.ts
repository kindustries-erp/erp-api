import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mã đối tác chỉ duy nhất trong các bản ghi chưa xóa mềm.
 * Thay unique index toàn bảng (không lọc is_deleted) bằng partial unique index.
 */
export class PartialUniqueBusinessPartnerCode20261018160000 implements MigrationInterface {
  name = 'PartialUniqueBusinessPartnerCode20261018160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_41e4debe2f4b2b1b011a6c6a9f"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_erp_business_partners_code_active"
        ON erp_business_partners (code)
        WHERE is_deleted = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_erp_business_partners_code_active"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_41e4debe2f4b2b1b011a6c6a9f" ON erp_business_partners (code)`,
    );
  }
}
