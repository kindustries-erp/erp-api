import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeDateToTimestamptz1782192149401 implements MigrationInterface {
  name = 'ChangeDateToTimestamptz1782192149401';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_transactions" ALTER COLUMN "transaction_date" TYPE TIMESTAMP WITH TIME ZONE USING "transaction_date"::timestamp with time zone`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ALTER COLUMN "receipt_date" TYPE TIMESTAMP WITH TIME ZONE USING "receipt_date"::timestamp with time zone`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ALTER COLUMN "issue_date" TYPE TIMESTAMP WITH TIME ZONE USING "issue_date"::timestamp with time zone`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ALTER COLUMN "issue_date" TYPE date USING "issue_date"::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ALTER COLUMN "receipt_date" TYPE date USING "receipt_date"::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_transactions" ALTER COLUMN "transaction_date" TYPE date USING "transaction_date"::date`,
    );
  }
}
