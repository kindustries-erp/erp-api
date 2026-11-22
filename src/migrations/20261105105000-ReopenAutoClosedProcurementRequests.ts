import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR từng bị tự đóng khi đặt đủ số lượng (CLOSED, close_reason IS NULL, ordering_status FULL).
 * Từ nay PR giữ APPROVED và chỉ CLOSED khi người dùng bấm Đóng (có lý do).
 * up() trả các PR tự đóng về APPROVED; không đụng PR đóng thủ công (có close_reason).
 *
 * down() không khôi phục: không phân biệt được PR APPROVED+FULL do migration này
 * trả về với PR APPROVED+FULL hợp lệ sau khi đổi logic. Rollback chỉ cần chạy lại
 * logic cũ trên code, không cần đổi dữ liệu.
 */
export class ReopenAutoClosedProcurementRequests20261105105000 implements MigrationInterface {
  name = 'ReopenAutoClosedProcurementRequests20261105105000';

  private readonly tables = ['erp_garage_proc_requests', 'erp_proc_requests'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `UPDATE "${table}"
         SET "status" = 'APPROVED', "closed_at" = NULL
         WHERE "status" = 'CLOSED'
           AND "close_reason" IS NULL
           AND "ordering_status" = 'FULL'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Không khôi phục dữ liệu (xem ghi chú phía trên).
  }
}
