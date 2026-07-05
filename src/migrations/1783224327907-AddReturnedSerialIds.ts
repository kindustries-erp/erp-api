import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReturnedSerialIds1783224327907 implements MigrationInterface {
  name = 'AddReturnedSerialIds1783224327907';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD "returned_serial_ids" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN "returned_serial_ids"`,
    );
  }
}
