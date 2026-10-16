import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chuyển dòng garage-opex sinh từ phiếu chi (có source_cashflow_voucher_id):
 * - 4. HHBH: HOA_HONG_TRUC_TIEP → HHBH (mục 4.2 Chi phí bán hàng)
 * - 8. Vật tư tiêu hao: CHI_PHI_TRUC_TIEP_KHAC → VAT_TU_TIEU_HAO (nhóm Giá vốn)
 * Không đụng dòng nhập tay.
 */
export class RemapCashflowOpexCategories20261017120000 implements MigrationInterface {
  name = 'RemapCashflowOpexCategories20261017120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "category_key" = 'HHBH', "category_name" = 'HHBH'
      WHERE "source_cashflow_voucher_id" IS NOT NULL
        AND "category_key" = 'HOA_HONG_TRUC_TIEP'
    `);

    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "category_key" = 'VAT_TU_TIEU_HAO', "category_name" = 'Vật tư tiêu hao'
      WHERE "source_cashflow_voucher_id" IS NOT NULL
        AND "category_key" = 'CHI_PHI_TRUC_TIEP_KHAC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "category_key" = 'HOA_HONG_TRUC_TIEP',
          "category_name" = 'Hoa hồng trực tiếp DV (Tính vào Giá vốn)'
      WHERE "source_cashflow_voucher_id" IS NOT NULL
        AND "category_key" = 'HHBH'
    `);

    await queryRunner.query(`
      UPDATE "kgara_operating_expenses"
      SET "category_key" = 'CHI_PHI_TRUC_TIEP_KHAC',
          "category_name" = 'Chi phí trực tiếp khác (Tính vào Giá vốn)'
      WHERE "source_cashflow_voucher_id" IS NOT NULL
        AND "category_key" = 'VAT_TU_TIEU_HAO'
    `);
  }
}
