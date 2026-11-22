import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm cột `cloned_from_id` (uuid, nullable) cho 4 bảng header PR/PO (ERP và Garage).
 * Lưu chứng từ gốc khi người dùng nhân bản phiếu đã từ chối/hủy để lập lại.
 * Không backfill (môi trường test), không đổi dữ liệu nào khác.
 * down() bỏ cột.
 */
const TABLES: readonly string[] = [
  'erp_proc_requests',
  'erp_proc_orders',
  'proc_requests_garage',
  'proc_orders_garage',
];

export class AddClonedFromToProcurement20261111100000 implements MigrationInterface {
  name = 'AddClonedFromToProcurement20261111100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "cloned_from_id" uuid`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "cloned_from_id"`,
      );
    }
  }
}
