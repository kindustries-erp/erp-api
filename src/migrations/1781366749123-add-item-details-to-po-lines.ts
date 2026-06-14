import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemDetailsToPoLines1781366749123 implements MigrationInterface {
  name = 'AddItemDetailsToPoLines1781366749123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD "item_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD "item_code" character varying(128)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP COLUMN "item_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP COLUMN "item_name"`,
    );
  }
}
