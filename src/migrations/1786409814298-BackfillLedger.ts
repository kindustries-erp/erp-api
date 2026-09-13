import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillLedger1786409814298 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Populate vinfast_parts_catalog
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

    // Populate vinfast_parts_ledger
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
    await queryRunner.query(`TRUNCATE TABLE vinfast_parts_ledger`);
    await queryRunner.query(`TRUNCATE TABLE vinfast_parts_catalog CASCADE`);
  }
}
