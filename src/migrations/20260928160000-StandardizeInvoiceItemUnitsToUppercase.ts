import { MigrationInterface, QueryRunner } from 'typeorm';

export class StandardizeInvoiceItemUnitsToUppercase20260928160000 implements MigrationInterface {
  name = 'StandardizeInvoiceItemUnitsToUppercase20260928160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Chuẩn hóa toàn bộ dữ liệu đơn vị tính (unit) hiện có trong bảng erp_invoice_items sang UPPERCASE & TRIM
    await queryRunner.query(`
      UPDATE erp_invoice_items
      SET unit = UPPER(TRIM(unit))
      WHERE unit IS NOT NULL AND TRIM(unit) != '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không thể hoàn tác chữ thường cụ thể do là biến đổi 1 chiều, giữ nguyên trạng thái
  }
}
