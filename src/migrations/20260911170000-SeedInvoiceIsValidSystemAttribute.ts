import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInvoiceIsValidSystemAttribute20260911170000 implements MigrationInterface {
  name = 'SeedInvoiceIsValidSystemAttribute20260911170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // 1. INVOICE_IN: Ensure default system attribute "is_valid" (CHECKBOX)
    // ========================================================================
    const existingInvoiceInIsValid = await queryRunner.query(`
      SELECT id FROM "erp_module_attribute_defs"
      WHERE "module_key_global" = 'INVOICE_IN'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" = 'is_valid'
      LIMIT 1;
    `);

    let invInIsValidDefId: string;
    if (existingInvoiceInIsValid && existingInvoiceInIsValid.length > 0) {
      invInIsValidDefId = existingInvoiceInIsValid[0].id;
      await queryRunner.query(
        `
        UPDATE "erp_module_attribute_defs"
        SET "is_system" = true,
            "code" = 'is_valid',
            "name" = 'Hóa đơn hợp lý, hợp lệ',
            "name_en" = 'Valid Invoice',
            "field_type" = 'CHECKBOX',
            "sort_order" = 10,
            "updated_at" = now()
        WHERE "id" = $1;
      `,
        [invInIsValidDefId],
      );
    } else {
      const inserted = await queryRunner.query(`
        INSERT INTO "erp_module_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'INVOICE_IN', 'is_valid', 'Hóa đơn hợp lý, hợp lệ', 'Valid Invoice',
          'CHECKBOX', 10, false, true, true, false,
          now(), now()
        )
        RETURNING "id";
      `);
      invInIsValidDefId = inserted[0].id;
    }

    // ========================================================================
    // 2. INVOICE_OUT: Ensure default system attribute "is_valid" (CHECKBOX)
    // ========================================================================
    const existingInvoiceOutIsValid = await queryRunner.query(`
      SELECT id FROM "erp_module_attribute_defs"
      WHERE "module_key_global" = 'INVOICE_OUT'
        AND "is_global" = true
        AND "is_deleted" = false
        AND "code" = 'is_valid'
      LIMIT 1;
    `);

    let invOutIsValidDefId: string;
    if (existingInvoiceOutIsValid && existingInvoiceOutIsValid.length > 0) {
      invOutIsValidDefId = existingInvoiceOutIsValid[0].id;
      await queryRunner.query(
        `
        UPDATE "erp_module_attribute_defs"
        SET "is_system" = true,
            "code" = 'is_valid',
            "name" = 'Hóa đơn hợp lý, hợp lệ',
            "name_en" = 'Valid Invoice',
            "field_type" = 'CHECKBOX',
            "sort_order" = 10,
            "updated_at" = now()
        WHERE "id" = $1;
      `,
        [invOutIsValidDefId],
      );
    } else {
      const inserted = await queryRunner.query(`
        INSERT INTO "erp_module_attribute_defs" (
          "id", "is_global", "module_key_global", "code", "name", "name_en",
          "field_type", "sort_order", "is_required", "is_active", "is_system", "is_deleted",
          "created_at", "updated_at"
        ) VALUES (
          gen_random_uuid(), true, 'INVOICE_OUT', 'is_valid', 'Hóa đơn hợp lý, hợp lệ', 'Valid Invoice',
          'CHECKBOX', 10, false, true, true, false,
          now(), now()
        )
        RETURNING "id";
      `);
      invOutIsValidDefId = inserted[0].id;
    }

    // ========================================================================
    // 3. BACKFILL DATA TO erp_entity_attribute_values
    // ========================================================================
    if (invInIsValidDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'INVOICE_IN',
          inv.id,
          $1,
          CASE WHEN inv.is_valid = true THEN 'true' ELSE 'false' END,
          now(),
          now()
        FROM "erp_invoices" inv
        WHERE inv.is_deleted = false
          AND (inv.tax_invoice_type IS NULL OR inv.tax_invoice_type != 'OUT')
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type IN ('INVOICE', 'INVOICE_IN')
              AND eav.entity_id = inv.id
              AND eav.attr_def_id = $1
          );
      `,
        [invInIsValidDefId],
      );
    }

    if (invOutIsValidDefId) {
      await queryRunner.query(
        `
        INSERT INTO "erp_entity_attribute_values" (
          "id", "entity_type", "entity_id", "attr_def_id", "value_text", "created_at", "updated_at"
        )
        SELECT 
          gen_random_uuid(),
          'INVOICE_OUT',
          inv.id,
          $1,
          CASE WHEN inv.is_valid = true THEN 'true' ELSE 'false' END,
          now(),
          now()
        FROM "erp_invoices" inv
        WHERE inv.is_deleted = false
          AND inv.tax_invoice_type = 'OUT'
          AND NOT EXISTS (
            SELECT 1 FROM "erp_entity_attribute_values" eav
            WHERE eav.entity_type IN ('INVOICE', 'INVOICE_OUT')
              AND eav.entity_id = inv.id
              AND eav.attr_def_id = $1
          );
      `,
        [invOutIsValidDefId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete EAV records created for is_valid on invoices
    await queryRunner.query(`
      DELETE FROM "erp_entity_attribute_values"
      WHERE "entity_type" IN ('INVOICE_IN', 'INVOICE_OUT')
        AND "attr_def_id" IN (
          SELECT id FROM "erp_module_attribute_defs"
          WHERE "module_key_global" IN ('INVOICE_IN', 'INVOICE_OUT')
            AND "code" = 'is_valid'
            AND "is_system" = true
        );
    `);

    // Delete system attribute defs for is_valid
    await queryRunner.query(`
      DELETE FROM "erp_module_attribute_defs"
      WHERE "module_key_global" IN ('INVOICE_IN', 'INVOICE_OUT')
        AND "code" = 'is_valid'
        AND "is_system" = true;
    `);
  }
}
