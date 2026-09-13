import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateVehicleBranchIdForSoldSerials20260725100000 implements MigrationInterface {
  name = 'UpdateVehicleBranchIdForSoldSerials20260725100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE erp_vehicles v
       SET branch_id = so.customer_id
       FROM erp_inventory_tracking_serials ts
       JOIN erp_sales_order_lines sol ON ts.sales_order_line_id = sol.id
       JOIN erp_sales_orders so ON sol.sales_order_id = so.id
       WHERE v.id = ts.vin_id
         AND ts.status = 'SOLD'
         AND v.branch_id IS NULL
         AND so.customer_id IS NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE erp_vehicles v
       SET branch_id = NULL
       FROM erp_inventory_tracking_serials ts
       JOIN erp_sales_order_lines sol ON ts.sales_order_line_id = sol.id
       JOIN erp_sales_orders so ON sol.sales_order_id = so.id
       WHERE v.id = ts.vin_id
         AND ts.status = 'SOLD'
         AND v.branch_id = so.customer_id;`,
    );
  }
}
