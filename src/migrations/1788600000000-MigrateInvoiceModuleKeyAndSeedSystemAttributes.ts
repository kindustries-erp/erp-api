import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateInvoiceModuleKeyAndSeedSystemAttributes1788600000000 implements MigrationInterface {
  name = 'MigrateInvoiceModuleKeyAndSeedSystemAttributes1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Migrate existing 'INVOICE' records to 'INVOICE_IN'
    await queryRunner.query(`
      UPDATE "erp_bom_categories"
      SET "module_key" = 'INVOICE_IN', "updated_at" = now()
      WHERE "module_key" = 'INVOICE';
    `);

    await queryRunner.query(`
      UPDATE "erp_bom_attribute_defs"
      SET "module_key_global" = 'INVOICE_IN', "updated_at" = now()
      WHERE "module_key_global" = 'INVOICE';
    `);

    await queryRunner.query(`
      UPDATE "erp_entity_attribute_values"
      SET "entity_type" = 'INVOICE_IN', "updated_at" = now()
      WHERE "entity_type" = 'INVOICE';
    `);

    // 2. INVOICE_IN: Ensure default system attribute "type_invoice_in" with bilingual options
    const defaultInvoiceInOptions = JSON.stringify([
      {
        value: 'PURCHASE_GOODS',
        label: 'Mua hàng hóa / NVL',
        labelEn: 'Goods & Raw Materials Purchase',
        labels: {
          vi: 'Mua hàng hóa / NVL',
          en: 'Goods & Raw Materials Purchase',
        },
      },
      {
        value: 'EXPENSE_OPEX',
        label: 'Chi phí quản lý & Vận hành (OPEX)',
        labelEn: 'Operating Expenses (OPEX)',
        labels: {
          vi: 'Chi phí quản lý & Vận hành (OPEX)',
          en: 'Operating Expenses (OPEX)',
        },
      },
      {
        value: 'SERVICE_FEE',
        label: 'Dịch vụ & Gia công ngoài',
        labelEn: 'Services & Subcontracting',
        labels: {
          vi: 'Dịch vụ & Gia công ngoài',
          en: 'Services & Subcontracting',
        },
      },
      {
        value: 'FIXED_ASSET',
        label: 'Tài sản cố định & CCDC',
        labelEn: 'Fixed Assets & Tools',
        labels: {
          vi: 'Tài sản cố định & CCDC',
          en: 'Fixed Assets & Tools',
        },
      },
      {
        value: 'OTHER',
        label: 'Khác',
        labelEn: 'Other',
        labels: { vi: 'Khác', en: 'Other' },
      },
    ]);

    const existingInvoiceInType = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'INVOICE_IN'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type_invoice_in', 'type', 'invoice_type')
      LIMIT 1;
    `);

    if (existingInvoiceInType && existingInvoiceInType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_invoice_in',
            "name" = 'Phân loại hóa đơn mua vào',
            "name_en" = 'Input Invoice Type',
            "field_type" = 'SELECT',
            "options" = $1::jsonb
        WHERE "id" = $2;
      `,
        [defaultInvoiceInOptions, existingInvoiceInType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'INVOICE_IN', 'type_invoice_in', 'Phân loại hóa đơn mua vào', 'Input Invoice Type',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultInvoiceInOptions],
      );
    }

    // 3. INVOICE_OUT: Ensure default system attribute "type_invoice_out" with bilingual options
    const defaultInvoiceOutOptions = JSON.stringify([
      {
        value: 'SALE_GOODS',
        label: 'Bán hàng hóa / Xe / Phụ tùng',
        labelEn: 'Goods & Parts Sales',
        labels: {
          vi: 'Bán hàng hóa / Xe / Phụ tùng',
          en: 'Goods & Parts Sales',
        },
      },
      {
        value: 'SALE_SERVICE',
        label: 'Dịch vụ sửa chữa & Garage',
        labelEn: 'Service & Repair Sales',
        labels: {
          vi: 'Dịch vụ sửa chữa & Garage',
          en: 'Service & Repair Sales',
        },
      },
      {
        value: 'SALE_FINANCIAL',
        label: 'Doanh thu hoạt động tài chính',
        labelEn: 'Financial Revenue',
        labels: {
          vi: 'Doanh thu hoạt động tài chính',
          en: 'Financial Revenue',
        },
      },
      {
        value: 'OTHER_INCOME',
        label: 'Thu nhập khác',
        labelEn: 'Other Income',
        labels: { vi: 'Thu nhập khác', en: 'Other Income' },
      },
    ]);

    const existingInvoiceOutType = await queryRunner.query(`
      SELECT id, code FROM "erp_bom_attribute_defs"
      WHERE "module_key_global" = 'INVOICE_OUT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" IN ('type_invoice_out', 'type', 'invoice_type')
      LIMIT 1;
    `);

    if (existingInvoiceOutType && existingInvoiceOutType.length > 0) {
      await queryRunner.query(
        `
        UPDATE "erp_bom_attribute_defs"
        SET "is_system" = true,
            "code" = 'type_invoice_out',
            "name" = 'Phân loại hóa đơn bán ra',
            "name_en" = 'Output Invoice Type',
            "field_type" = 'SELECT',
            "options" = $1::jsonb
        WHERE "id" = $2;
      `,
        [defaultInvoiceOutOptions, existingInvoiceOutType[0].id],
      );
    } else {
      await queryRunner.query(
        `
        INSERT INTO "erp_bom_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "options", "sort_order", "is_required", "is_active", "is_system", "is_deleted"
        ) VALUES (
          gen_random_uuid(), true, 'INVOICE_OUT', 'type_invoice_out', 'Phân loại hóa đơn bán ra', 'Output Invoice Type',
          'SELECT', $1::jsonb, 0, false, true, true, false
        );
      `,
        [defaultInvoiceOutOptions],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert 'INVOICE_IN' and 'INVOICE_OUT' to 'INVOICE'
    await queryRunner.query(`
      DELETE FROM "erp_bom_attribute_defs"
      WHERE "code" IN ('type_invoice_in', 'type_invoice_out') AND "is_system" = true;
    `);

    await queryRunner.query(`
      UPDATE "erp_bom_categories"
      SET "module_key" = 'INVOICE', "updated_at" = now()
      WHERE "module_key" IN ('INVOICE_IN', 'INVOICE_OUT');
    `);

    await queryRunner.query(`
      UPDATE "erp_bom_attribute_defs"
      SET "module_key_global" = 'INVOICE', "updated_at" = now()
      WHERE "module_key_global" IN ('INVOICE_IN', 'INVOICE_OUT');
    `);

    await queryRunner.query(`
      UPDATE "erp_entity_attribute_values"
      SET "entity_type" = 'INVOICE', "updated_at" = now()
      WHERE "entity_type" IN ('INVOICE_IN', 'INVOICE_OUT');
    `);
  }
}
