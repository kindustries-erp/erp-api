import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanInvoiceInCustomAttributes1788700000000 implements MigrationInterface {
  name = 'CleanInvoiceInCustomAttributes1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Determine attribute defs table
    const attrDefTableRes = await queryRunner.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('erp_module_attribute_defs', 'erp_bom_attribute_defs')
      ORDER BY CASE WHEN table_name = 'erp_module_attribute_defs' THEN 1 ELSE 2 END
      LIMIT 1;
    `);
    const attrDefTable = attrDefTableRes?.[0]?.table_name;

    if (!attrDefTable) {
      return;
    }

    // 1. Lấy danh sách ID của các thuộc tính tùy chỉnh cũ trong INVOICE_IN (không phải thuộc tính hệ thống)
    const oldDefs = await queryRunner.query(`
      SELECT id FROM "${attrDefTable}"
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
        DELETE FROM "${attrDefTable}"
        WHERE "id" IN (${ids});
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không cần khôi phục lại dữ liệu demo test
  }
}
