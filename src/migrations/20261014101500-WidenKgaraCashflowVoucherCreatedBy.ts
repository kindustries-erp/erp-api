import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenKgaraCashflowVoucherCreatedBy20261014101500 implements MigrationInterface {
  name = 'WidenKgaraCashflowVoucherCreatedBy20261014101500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ALTER COLUMN "created_by" TYPE character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ALTER COLUMN "created_by" TYPE character varying(50)`,
    );
  }
}
