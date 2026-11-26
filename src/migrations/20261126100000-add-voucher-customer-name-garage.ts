import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tách tên khách trên phiếu KGara (`TenKhachHang`) khỏi tên khách danh mục (`KhachHangName`).
 * Trước đây sync gộp `khach_hang_name = KhachHangName || TenKhachHang`.
 * - V1 `kgara_cases.ten_khach_hang`: backfill từ `raw_data.TenKhachHang`.
 * - V1 `khach_hang_name`: phiếu từng bị lấy tên trên phiếu thay chỗ (KGara không trả `KhachHangName`)
 *   được trả về NULL, đúng nghĩa tên khách danh mục.
 * - V2 `cases_garage.voucher_customer_name` + `source_snapshot.voucherCustomerName` chép từ V1 (cùng UUID);
 *   `customer_name` theo lại V1 khi chưa bị sửa tay ở v2 (không có khóa `customerName` trong `overrides`).
 * down(): xóa hai cột mới và khóa snapshot. Không khôi phục giá trị gộp cũ của `khach_hang_name`
 * (sync lần sau tự ghi lại theo code đang chạy).
 */
export class AddVoucherCustomerNameGarage20261126100000 implements MigrationInterface {
  name = 'AddVoucherCustomerNameGarage20261126100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "ten_khach_hang" varchar(255) NULL`,
    );
    await queryRunner.query(`
      UPDATE "kgara_cases"
      SET "ten_khach_hang" = NULLIF("raw_data"->>'TenKhachHang', '')
      WHERE "ten_khach_hang" IS NULL
        AND NULLIF("raw_data"->>'TenKhachHang', '') IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "kgara_cases"
      SET "khach_hang_name" = NULL
      WHERE "raw_data" IS NOT NULL
        AND NULLIF("raw_data"->>'KhachHangName', '') IS NULL
        AND "khach_hang_name" IS NOT NULL
        AND "khach_hang_name" = NULLIF("raw_data"->>'TenKhachHang', '')
    `);

    await queryRunner.query(
      `ALTER TABLE "cases_garage" ADD COLUMN IF NOT EXISTS "voucher_customer_name" varchar(255) NULL`,
    );
    await queryRunner.query(`
      UPDATE "cases_garage" c
      SET
        "source_snapshot" = c."source_snapshot"
          || jsonb_build_object('voucherCustomerName', k."ten_khach_hang"),
        "voucher_customer_name" = COALESCE(c."voucher_customer_name", k."ten_khach_hang")
      FROM "kgara_cases" k
      WHERE k."id" = c."id" AND k."ten_khach_hang" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "cases_garage" c
      SET
        "source_snapshot" = c."source_snapshot"
          || jsonb_build_object('customerName', k."khach_hang_name"),
        "customer_name" = CASE
          WHEN c."overrides" ? 'customerName' THEN c."customer_name"
          ELSE k."khach_hang_name"
        END
      FROM "kgara_cases" k
      WHERE k."id" = c."id"
        AND c."source_snapshot"->>'customerName' IS DISTINCT FROM k."khach_hang_name"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "cases_garage"
      SET
        "source_snapshot" = "source_snapshot" - 'voucherCustomerName',
        "overrides" = "overrides" - 'voucherCustomerName'
    `);
    await queryRunner.query(
      `ALTER TABLE "cases_garage" DROP COLUMN IF EXISTS "voucher_customer_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "ten_khach_hang"`,
    );
  }
}
