import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTrackingSerialsAttributesForDealers20260725103000 implements MigrationInterface {
  name = 'UpdateTrackingSerialsAttributesForDealers20260725103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE erp_inventory_tracking_serials ts
       SET attributes = COALESCE(ts.attributes, '{}'::jsonb) || jsonb_build_object('dealer_code', bp.code, 'dealer_name', bp.name)
       FROM erp_sales_order_lines sol
       JOIN erp_sales_orders so ON sol.sales_order_id = so.id
       JOIN erp_business_partners bp ON so.customer_id = bp.id
       WHERE ts.sales_order_line_id = sol.id
         AND ts.status = 'SOLD'
         AND (ts.attributes->>'dealer_code' IS NULL OR ts.attributes->>'dealer_name' IS NULL);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE erp_inventory_tracking_serials ts
       SET attributes = ts.attributes - 'dealer_code' - 'dealer_name'
       FROM erp_sales_order_lines sol
       JOIN erp_sales_orders so ON sol.sales_order_id = so.id
       JOIN erp_business_partners bp ON so.customer_id = bp.id
       WHERE ts.sales_order_line_id = sol.id
         AND ts.status = 'SOLD'
         AND ts.attributes->>'dealer_code' = bp.code;`,
    );
  }
}
