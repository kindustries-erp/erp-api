import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesOrderFields1783156001681 implements MigrationInterface {
  name = 'AddSalesOrderFields1783156001681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD "expected_delivery_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD "item_name" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP COLUMN "item_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP COLUMN "expected_delivery_date"`,
    );
  }
}
