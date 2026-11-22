import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm cột `closed_by` (uuid, nullable) cho 4 bảng header PR/PO (ERP và Garage),
 * để biết ai đã đóng chứng từ thiếu. Backfill từ nhật ký erp_approval_events:
 * chỉ gán cho chứng từ đã CLOSED có lý do đóng (đóng thủ công). Đóng tự động
 * do đủ hàng không có lý do nên giữ NULL. Không đổi dữ liệu nào khác.
 * down() bỏ cột, mất thông tin người đóng đã backfill.
 */
const TARGETS: ReadonlyArray<readonly [string, string]> = [
  ['erp_proc_requests', 'PROCUREMENT_REQUEST'],
  ['erp_proc_orders', 'PROCUREMENT_ORDER'],
  ['proc_requests_garage', 'GARAGE_PROCUREMENT_REQUEST'],
  ['proc_orders_garage', 'GARAGE_PROCUREMENT_ORDER'],
];

export class AddClosedByToProcurement20261108130000 implements MigrationInterface {
  name = 'AddClosedByToProcurement20261108130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, docType] of TARGETS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "closed_by" uuid`,
      );
      await queryRunner.query(
        `UPDATE "${table}" AS t
            SET "closed_by" = e.actor_id
           FROM (
             SELECT DISTINCT ON (doc_id) doc_id, actor_id
               FROM erp_approval_events
              WHERE doc_type = $1 AND action = 'close'
              ORDER BY doc_id, created_at DESC
           ) AS e
          WHERE t.id = e.doc_id
            AND t."closed_by" IS NULL
            AND t."status" = 'CLOSED'
            AND t."close_reason" IS NOT NULL`,
        [docType],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table] of TARGETS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "closed_by"`,
      );
    }
  }
}
