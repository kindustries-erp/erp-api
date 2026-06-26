import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeCreatedAtToTimestamptz1782192149402 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix existing shifted data (+7 hours to make it UTC)
    await queryRunner.query(
      `UPDATE erp_goods_receipts SET created_at = created_at + interval '7 hours', updated_at = updated_at + interval '7 hours'`,
    );
    await queryRunner.query(
      `UPDATE erp_goods_issues SET created_at = created_at + interval '7 hours', updated_at = updated_at + interval '7 hours'`,
    );

    await queryRunner.query(
      `ALTER TABLE erp_goods_receipts ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_goods_receipts ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_goods_issues ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_goods_issues ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE erp_goods_receipts ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_goods_receipts ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_goods_issues ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_goods_issues ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
    );
  }
}
