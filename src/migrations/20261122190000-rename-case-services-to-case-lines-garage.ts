import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đổi tên bảng dòng vụ việc garage: `case_services_garage` -> `case_lines_garage`
 * (khớp mẫu `<header>_lines_<hậu tố>`). Chỉ đổi tên, dữ liệu giữ nguyên.
 * Các index/constraint đặt tên tường minh được đổi theo; tên băm của TypeORM giữ nguyên.
 */
export class RenameCaseServicesToCaseLinesGarage20261122190000 implements MigrationInterface {
  name = 'RenameCaseServicesToCaseLinesGarage20261122190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "case_services_garage" RENAME TO "case_lines_garage"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_case_services_garage_legacy_service_id" RENAME TO "UQ_case_lines_garage_legacy_service_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_case_lines_garage_legacy_service_id" RENAME TO "UQ_case_services_garage_legacy_service_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_lines_garage" RENAME TO "case_services_garage"`,
    );
  }
}
