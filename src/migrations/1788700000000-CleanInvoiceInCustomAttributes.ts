import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanInvoiceInCustomAttributes1788700000000 implements MigrationInterface {
  name = 'CleanInvoiceInCustomAttributes1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Lấy danh sách ID của các thuộc tính tùy chỉnh cũ trong INVOICE_IN (không phải thuộc tính hệ thống)
    const oldDefs = await queryRunner.query(`
      SELECT id FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'INVOICE_IN'
        AND "is_system" = false
        AND "code" IN ('attr-1', 'attr-2');
    `);

    if (oldDefs && oldDefs.length > 0) {
      const ids = oldDefs.map((d: any) => `'${d.id}'`).join(',');

      // 2. Xóa các giá trị tương ứng trong erp_entity_attribute_values
      await queryRunner.query(`
        DELETE FROM "erp_entity_attribute_values"
        WHERE "attr_def_id" IN (${ids});
      `);

      // 3. Xóa các định nghĩa thuộc tính tùy chỉnh demo
      await queryRunner.query(`
        DELETE FROM "erp_bom_attribute_defs"
        WHERE "id" IN (${ids});
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không cần khôi phục lại dữ liệu demo test
  }
}
