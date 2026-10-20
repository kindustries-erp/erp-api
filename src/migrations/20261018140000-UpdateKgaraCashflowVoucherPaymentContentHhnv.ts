import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateKgaraCashflowVoucherPaymentContentHhnv20261018140000 implements MigrationInterface {
  name = 'UpdateKgaraCashflowVoucherPaymentContentHhnv20261018140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_content" = CASE
        WHEN "payment_content" IN ('10. Hoa hồng / nhân công', 'Hoa hồng / nhân công', '5. HHNV', 'HHNV') THEN '6. HH Thưởng'
        WHEN "payment_content" = '5. Ứng trước' THEN '7. Ứng trước'
        WHEN "payment_content" = '6. Cấn trừ' THEN '8. Cấn trừ'
        WHEN "payment_content" = '7. Phụ tùng / vật tư' THEN '9. Phụ tùng / vật tư'
        WHEN "payment_content" = '8. Vật tư tiêu hao' THEN '10. Vật tư tiêu hao'
        WHEN "payment_content" = '9. Chi phí vận hành' THEN '11. Chi phí vận hành'
        WHEN "payment_content" = '11. Hoàn ứng' THEN '12. Hoàn ứng'
        WHEN "payment_content" = '12. Khác' THEN '13. Khác'
        ELSE "payment_content"
      END
      WHERE "payment_content" IS NOT NULL AND "payment_content" != '';
    `);

    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "note" = REPLACE("note", '(8. Vật tư tiêu hao)', '(10. Vật tư tiêu hao)')
      WHERE "note" LIKE '%(8. Vật tư tiêu hao)%';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_content" = CASE
        WHEN "payment_content" IN ('6. HH Thưởng', 'HH Thưởng', '5. HHNV', 'HHNV') THEN '10. Hoa hồng / nhân công'
        WHEN "payment_content" = '7. Ứng trước' THEN '5. Ứng trước'
        WHEN "payment_content" = '8. Cấn trừ' THEN '6. Cấn trừ'
        WHEN "payment_content" = '9. Phụ tùng / vật tư' THEN '7. Phụ tùng / vật tư'
        WHEN "payment_content" = '10. Vật tư tiêu hao' THEN '8. Vật tư tiêu hao'
        WHEN "payment_content" = '11. Chi phí vận hành' THEN '9. Chi phí vận hành'
        WHEN "payment_content" = '12. Hoàn ứng' THEN '11. Hoàn ứng'
        WHEN "payment_content" = '13. Khác' THEN '12. Khác'
        ELSE "payment_content"
      END
      WHERE "payment_content" IS NOT NULL AND "payment_content" != '';
    `);

    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "note" = REPLACE("note", '(10. Vật tư tiêu hao)', '(8. Vật tư tiêu hao)')
      WHERE "note" LIKE '%(10. Vật tư tiêu hao)%';
    `);
  }
}
