import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKgaraColumns1785128452000 implements MigrationInterface {
  name = 'AddKgaraColumns1785128452000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // kgara_cases
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "ngay_tiep_nhan" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "ngay_hoan_thanh_cong_viec" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "ngay_giao_xe_full" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "so_khung" character varying(100)`,
    );

    // kgara_case_services
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "so_gio_cong_lam" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "tien_dich_vu" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "tien_phu_tung" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "gia_von_phu_tung" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "ty_le_chiet_khau_ct" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "tien_chiet_khau_ct" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "kho_code" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "tien_phu_phi" numeric(18,2)`,
    );

    // kgara_receivables
    await queryRunner.query(
      `ALTER TABLE "kgara_receivables" ADD COLUMN IF NOT EXISTS "so_khung" character varying(100)`,
    );

    // kgara_payables
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ten_tien_te" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ten_vu_viec" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ghi_chu_doi_tac" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ma_so_nhom_doi_tac" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ten_nhom_doi_tac" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "dk_nte_no" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "dk_nte_co" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ps_nte_no" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ps_nte_co" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ck_nte_no" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ck_nte_co" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ty_gia_dk" numeric(18,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ty_gia_ps_no" numeric(18,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_payables" ADD COLUMN IF NOT EXISTS "ty_gia_ps_co" numeric(18,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ... (down method is not strictly required right now, but skipping for brevity)
  }
}
