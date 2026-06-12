import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeDatesAndAddress1781254765936 implements MigrationInterface {
  name = 'AddEmployeeDatesAndAddress1781254765936';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "erp_employees" ADD "address" text`);
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD "start_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD "leave_date" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "leave_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "start_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "address"`,
    );
  }
}
