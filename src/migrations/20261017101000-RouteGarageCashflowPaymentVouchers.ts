import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quy tắc phiếu chi garage:
 * - Chỉ phiếu chi `PAID` và nội dung không phải 4/8 mới có settlement PAYMENT (trừ công nợ garage).
 * - Phiếu chi nội dung `4. HHBH` / `8. Vật tư tiêu hao` ở trạng thái APPROVED/PAID ghi vào
 *   kgara_operating_expenses (nhóm Giá vốn) thay vì trừ công nợ.
 */
export class RouteGarageCashflowPaymentVouchers20261017101000 implements MigrationInterface {
  name = 'RouteGarageCashflowPaymentVouchers20261017101000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa settlement PAYMENT của phiếu chi không đủ điều kiện trừ công nợ
    await queryRunner.query(`
      DELETE FROM "kgara_case_settlements" s
      USING "kgara_cashflow_vouchers" v
      WHERE s."cashflow_voucher_id" = v."id"
        AND s."settlement_type" = 'PAYMENT'
        AND (
          COALESCE(v."payment_status", '') <> 'PAID'
          OR v."payment_content" IN ('4. HHBH', '8. Vật tư tiêu hao')
        )
    `);

    // 2. Backfill dòng garage-opex cho phiếu chi 4/8 đã duyệt / đã chi
    await queryRunner.query(`
      INSERT INTO "kgara_operating_expenses" (
        "id", "period_year", "period_month", "category_key", "category_name",
        "amount", "oj_amount", "note", "source_cashflow_voucher_id"
      )
      SELECT
        uuid_generate_v4(),
        EXTRACT(YEAR FROM v."trans_date")::smallint,
        EXTRACT(MONTH FROM v."trans_date")::smallint,
        CASE v."payment_content"
          WHEN '4. HHBH' THEN 'HOA_HONG_TRUC_TIEP'
          ELSE 'CHI_PHI_TRUC_TIEP_KHAC'
        END,
        CASE v."payment_content"
          WHEN '4. HHBH' THEN 'Hoa hồng trực tiếp DV (Tính vào Giá vốn)'
          ELSE 'Chi phí trực tiếp khác (Tính vào Giá vốn)'
        END,
        v."amount",
        0,
        'Từ phiếu chi ' || v."voucher_code" || ' (' || v."payment_content" || ')',
        v."id"
      FROM "kgara_cashflow_vouchers" v
      WHERE v."voucher_type" = 'PAYMENT'
        AND v."payment_status" IN ('APPROVED', 'PAID')
        AND v."payment_content" IN ('4. HHBH', '8. Vật tư tiêu hao')
        AND NOT EXISTS (
          SELECT 1 FROM "kgara_operating_expenses" o
          WHERE o."source_cashflow_voucher_id" = v."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Chỉ gỡ dòng opex sinh từ phiếu chi. Settlement PAYMENT đã xóa ở up() không khôi phục được.
    await queryRunner.query(
      `DELETE FROM "kgara_operating_expenses" WHERE "source_cashflow_voucher_id" IS NOT NULL`,
    );
  }
}
