import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillVinfastItemCodesAndLedger20260920170000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Backfill erp_invoice_items.item_code for VinFast part codes and batteries
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
        WHEN UPPER(description) LIKE '%ĐỘNG CƠ ĐIỆN%' AND UPPER(description) LIKE '%BẢO HÀNH%'
          THEN 'PVT20030000'
        WHEN (REGEXP_MATCH(UPPER(TRIM(description)), '^([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})([\\s\\-_:,]|$)'))[1] IS NOT NULL
          THEN (REGEXP_MATCH(UPPER(TRIM(description)), '^([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})([\\s\\-_:,]|$)'))[1]
        WHEN (REGEXP_MATCH(UPPER(TRIM(description)), '\\b([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})\\b'))[1] IS NOT NULL
          THEN (REGEXP_MATCH(UPPER(TRIM(description)), '\\b([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})\\b'))[1]
        ELSE item_code
      END
      WHERE (item_code IS NULL OR item_code = '')
        AND (
          UPPER(description) LIKE '%VF5_HV_BATTERY_PACK_38_KWH%'
          OR UPPER(description) LIKE '%HV_BATTERY_41.9KWH%'
          OR UPPER(description) LIKE '%BAT21001011%'
          OR UPPER(description) LIKE '%HV_BATTERY_PACK%'
          OR (UPPER(description) LIKE '%ĐỘNG CƠ ĐIỆN%' AND UPPER(description) LIKE '%BẢO HÀNH%')
          OR (REGEXP_MATCH(UPPER(TRIM(description)), '^([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})([\\s\\-_:,]|$)'))[1] IS NOT NULL
          OR (REGEXP_MATCH(UPPER(TRIM(description)), '\\b([A-Z]{3,6}[0-9]{5,8}[A-Z0-9]{0,3})\\b'))[1] IS NOT NULL
        );
    `);

    // 2. Re-seed VinFast parts catalog with newly backfilled items
    await queryRunner.query(`
      INSERT INTO vinfast_parts_catalog (sku, name, uom)
      SELECT DISTINCT ON (item_code)
        item_code as sku,
        SUBSTRING(description, 1, 255) as name,
        COALESCE(unit, 'Chiếc') as uom
      FROM erp_invoice_items
      WHERE item_code IS NOT NULL AND item_code != ''
      ORDER BY item_code, created_at DESC
      ON CONFLICT (sku) DO NOTHING;
    `);

    // 3. Re-seed VinFast parts ledger for all valid tax invoices (status 1: Active, 3: Adjustment)
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
      WHERE ii.item_code IS NOT NULL AND ii.item_code != ''
        AND i.tax_invoice_status IN (1, 3)
        AND NOT EXISTS (
          SELECT 1 FROM vinfast_parts_ledger l WHERE l.invoice_item_id = ii.id
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Migration is safe and additive, nothing destructive to revert
  }
}
