import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSerialsGeneratedToGoodsReceiptLine1785820174284 implements MigrationInterface {
  name = 'AddSerialsGeneratedToGoodsReceiptLine1785820174284';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD "serials_generated" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN "serials_generated"`,
    );
  }
}
