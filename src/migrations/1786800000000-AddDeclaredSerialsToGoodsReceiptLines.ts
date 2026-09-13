import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeclaredSerialsToGoodsReceiptLines1786800000000 implements MigrationInterface {
  name = 'AddDeclaredSerialsToGoodsReceiptLines1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD COLUMN IF NOT EXISTS "declared_serials" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN IF EXISTS "declared_serials"`,
    );
  }
}
