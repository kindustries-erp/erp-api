import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đặt mặc định khóa duyệt của Đơn mua Garage (GARAGE_PROCUREMENT_ORDER) = tắt.
 * PR Garage giữ bật. Khóa là cấu hình ngầm ở BE, không hiện trên UI.
 * Chỉ cập nhật dòng seed đã có; down() khôi phục về bật.
 */
export class SetGarageProcurementOrderApprovalOff20261106120000 implements MigrationInterface {
  name = 'SetGarageProcurementOrderApprovalOff20261106120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "erp_approval_settings"
      SET "approval_enabled" = false, "updated_at" = now()
      WHERE "doc_type" = 'GARAGE_PROCUREMENT_ORDER'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "erp_approval_settings"
      SET "approval_enabled" = true, "updated_at" = now()
      WHERE "doc_type" = 'GARAGE_PROCUREMENT_ORDER'
    `);
  }
}
