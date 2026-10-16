import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateKgaraCashflowVoucherPaymentContentClassification20261016140000 implements MigrationInterface {
  name = 'UpdateKgaraCashflowVoucherPaymentContentClassification20261016140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_content" = CASE
        WHEN "payment_content" = 'KH thanh toán' THEN '1. KH thanh toán'
        WHEN "payment_content" = 'Tất toán' THEN '2. Tất toán'
        WHEN "payment_content" = 'BH thanh toán' THEN '3. BH thanh toán'
        WHEN "payment_content" = 'HHBH' THEN '4. HHBH'
        WHEN "payment_content" = 'Ứng trước' THEN '5. Ứng trước'
        WHEN "payment_content" = 'Cấn trừ' THEN '6. Cấn trừ'
        WHEN "payment_content" IN ('Mua phụ tùng / vật tư', 'Phụ tùng / vật tư') THEN '7. Phụ tùng / vật tư'
        WHEN "payment_content" = 'Vật tư tiêu hao' THEN '8. Vật tư tiêu hao'
        WHEN "payment_content" = 'Chi phí vận hành' THEN '9. Chi phí vận hành'
        WHEN "payment_content" = 'Hoa hồng / nhân công' THEN '10. Hoa hồng / nhân công'
        WHEN "payment_content" = 'Hoàn ứng' THEN '11. Hoàn ứng'
        WHEN "payment_content" = 'Khác' THEN '12. Khác'
        ELSE "payment_content"
      END
      WHERE "payment_content" IS NOT NULL AND "payment_content" != '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_content" = CASE
        WHEN "payment_content" = '1. KH thanh toán' THEN 'KH thanh toán'
        WHEN "payment_content" = '2. Tất toán' THEN 'Tất toán'
        WHEN "payment_content" = '3. BH thanh toán' THEN 'BH thanh toán'
        WHEN "payment_content" = '4. HHBH' THEN 'HHBH'
        WHEN "payment_content" = '5. Ứng trước' THEN 'Ứng trước'
        WHEN "payment_content" = '6. Cấn trừ' THEN 'Cấn trừ'
        WHEN "payment_content" = '7. Phụ tùng / vật tư' THEN 'Mua phụ tùng / vật tư'
        WHEN "payment_content" = '8. Vật tư tiêu hao' THEN 'Vật tư tiêu hao'
        WHEN "payment_content" = '9. Chi phí vận hành' THEN 'Chi phí vận hành'
        WHEN "payment_content" = '10. Hoa hồng / nhân công' THEN 'Hoa hồng / nhân công'
        WHEN "payment_content" = '11. Hoàn ứng' THEN 'Hoàn ứng'
        WHEN "payment_content" = '12. Khác' THEN 'Khác'
        ELSE "payment_content"
      END
      WHERE "payment_content" IS NOT NULL AND "payment_content" != '';
    `);
  }
}
