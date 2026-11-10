import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm cột `extra_data` jsonb NOT NULL mặc định `{}` cho 22 bảng v2 (header, dòng, danh mục).
 * Hằng số mặc định không rewrite bảng (PG 16). CHECK bảo đảm giá trị luôn là object.
 * Không đổi kiểu cột timestamp của bảng cũ. down() bỏ cột, mất dữ liệu extra đã ghi.
 */
const TABLES: readonly string[] = [
  // PR/PO ERP
  'erp_proc_requests',
  'erp_proc_request_lines',
  'erp_proc_orders',
  'erp_proc_order_lines',
  'erp_proc_order_acceptances',
  // PR/PO Garage
  'proc_requests_garage',
  'proc_request_lines_garage',
  'proc_orders_garage',
  'proc_order_lines_garage',
  'proc_order_acceptances_garage',
  // Nhập kho Garage
  'goods_receipts_garage',
  'goods_receipt_lines_garage',
  // Chứng từ kho Garage
  'garage_stock_receipts',
  'garage_stock_receipt_lines',
  'garage_stock_issues',
  'garage_stock_issue_lines',
  'garage_stock_adjustments',
  'garage_stock_adjustment_lines',
  // Hóa đơn
  'erp_invoices',
  'erp_invoice_items',
  // Danh mục
  'erp_branches',
  'erp_business_partners',
];

const checkName = (table: string) => `CHK_${table}_extra_data_object`;

export class AddExtraDataToV2Tables20261108120000 implements MigrationInterface {
  name = 'AddExtraDataToV2Tables20261108120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${checkName(table)}" CHECK (jsonb_typeof("extra_data") = 'object')`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${checkName(table)}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "extra_data"`,
      );
    }
  }
}
