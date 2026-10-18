import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameHhThuongToHhXuong20261018150000 implements MigrationInterface {
  name = 'RenameHhThuongToHhXuong20261018150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_content" = CASE
        WHEN "payment_content" IN ('6. HH Thưởng', 'HH Thưởng') THEN '6. HH Xưởng'
        ELSE "payment_content"
      END
      WHERE "payment_content" IN ('6. HH Thưởng', 'HH Thưởng');
    `);

    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "note" = REPLACE("note", '(6. HH Thưởng)', '(6. HH Xưởng)')
      WHERE "note" LIKE '%(6. HH Thưởng)%';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_content" = CASE
        WHEN "payment_content" IN ('6. HH Xưởng', 'HH Xưởng') THEN '6. HH Thưởng'
        ELSE "payment_content"
      END
      WHERE "payment_content" IN ('6. HH Xưởng', 'HH Xưởng');
    `);

    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "note" = REPLACE("note", '(6. HH Xưởng)', '(6. HH Thưởng)')
      WHERE "note" LIKE '%(6. HH Xưởng)%';
    `);
  }
}
