import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixItemCodeMapping1786410741299 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Update erp_invoice_items.item_code using the old reports-core logic
    // This logic handles special cases like batteries and shorter SKUs
    await queryRunner.query(`
      UPDATE erp_invoice_items
      SET item_code = CASE
        WHEN UPPER(description) LIKE '%VF5_HV_BATTERY_PACK_38_KWH%'
          OR REGEXP_REPLACE(UPPER(description), '[^A-Z0-9]+', '_', 'g') LIKE '%VF5_HV_BATTERY_PACK_38_KWH%'
          THEN 'EEP73110011AP'
        WHEN UPPER(description) LIKE '%HV_BATTERY_41.9KWH%'
          OR REGEXP_REPLACE(UPPER(description), '[^A-Z0-9]+', '_', 'g') LIKE '%HV_BATTERY_41_9KWH%'
          OR REGEXP_REPLACE(UPPER(description), '[^A-Z0-9]+', '_', 'g') LIKE '%HV_BATTERY_41_9_KWH%'
          OR REGEXP_REPLACE(UPPER(description), '[^A-Z0-9]+', '_', 'g') LIKE '%BAT21001011%'
          THEN 'BAT21001011'
        WHEN UPPER(description) LIKE '%HV_BATTERY_PACK%'
          OR REGEXP_REPLACE(UPPER(description), '[^A-Z0-9]+', '_', 'g') LIKE '%HV_BATTERY_PACK%'
          THEN 'EEP73110011ALL'
        WHEN (REGEXP_MATCH(UPPER(description), '([A-Z]{3}[0-9][A-Z0-9]*)'))[1] IS NOT NULL
          THEN (REGEXP_MATCH(UPPER(description), '([A-Z]{3}[0-9][A-Z0-9]*)'))[1]
        ELSE item_code
      END
      WHERE item_code IS NULL;
    `);

    // 2. Clear existing ledger and catalog to re-seed cleanly
    await queryRunner.query(`TRUNCATE TABLE vinfast_parts_ledger`);
    await queryRunner.query(`DELETE FROM vinfast_parts_catalog`);

    // 3. Re-seed catalog
    await queryRunner.query(`
      INSERT INTO vinfast_parts_catalog (sku, name, uom)
      SELECT DISTINCT ON (item_code)
        item_code,
        SUBSTRING(description, 1, 255) as name,
        COALESCE(unit, 'Cái') as uom
      FROM erp_invoice_items
      WHERE item_code IS NOT NULL
      ORDER BY item_code, created_at DESC
      ON CONFLICT (sku) DO NOTHING;
    `);

    // 4. Re-seed ledger
    await queryRunner.query(`
      INSERT INTO vinfast_parts_ledger (
        part_sku, invoice_item_id, invoice_id, direction, qty, unit_cost, pre_vat_amount, 
        transaction_date, license_plate, is_adjustment, adj_sign, created_at
      )
      SELECT 
        ii.item_code,
        ii.id,
        i.id,
        i.direction,
        COALESCE(ii.quantity, 0) as qty,
        COALESCE(ii.unit_price, 0) as unit_cost,
        COALESCE(ii.pre_vat_amount, 0) as pre_vat_amount,
        i.invoice_date,
        i.license_plate,
        (i.tax_invoice_status = 3) as is_adjustment,
        CASE WHEN i.tax_invoice_status = 3 AND ii.quantity < 0 THEN -1 ELSE 1 END as adj_sign,
        i.created_at
      FROM erp_invoice_items ii
      JOIN erp_invoices i ON ii.invoice_id = i.id
      WHERE ii.item_code IS NOT NULL
        AND i.tax_invoice_status IN (1, 3);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot easily revert the UPDATE, but we can clear the tables
    await queryRunner.query(`TRUNCATE TABLE vinfast_parts_ledger`);
    await queryRunner.query(`DELETE FROM vinfast_parts_catalog`);
  }
}
