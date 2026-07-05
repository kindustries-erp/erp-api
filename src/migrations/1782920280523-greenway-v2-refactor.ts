import { MigrationInterface, QueryRunner } from 'typeorm';

export class GreenwayV2Refactor1782920280523 implements MigrationInterface {
  name = 'GreenwayV2Refactor1782920280523';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE "gw_receivables" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "gw_payables" CASCADE`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ec1d130bc48f433184606f838"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6d16c4a07d47e259eac0be5907"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b13a47e28e29e30989b94ae521"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c5c97ed8b4f17b17a30f129eee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "external_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "total_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "paid_amount"`,
    );
    await queryRunner.query(`ALTER TABLE "gw_receivables" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "gw_receivables" DROP COLUMN "code"`);
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "paid_amount"`,
    );
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "code"`);
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "external_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "total_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_auth" ADD "ss_client_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_branches" ADD "parent_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "so_chung_tu" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "bien_so_xe" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "khach_hang_code" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "khach_hang_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "tinh_trang_dich_vu" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "ten_tinh_trang_dich_vu" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "tien_co_thue" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "tien_da_thanh_toan" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "tien_con_phai_thanh_toan" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "ngay_phat_sinh" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" ADD "data_as_of" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "hd_phieu_dich_vu_id" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "so_chung_tu" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "khach_hang_code" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "khach_hang_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "bien_so_xe" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "tien_thanh_toan" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "tien_da_thanh_toan" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "ngay_phat_sinh" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "period_from" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "period_to" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "data_as_of" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "tai_khoan_id" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ma_so_tai_khoan" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ten_tai_khoan" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "doi_tac_id" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ma_so_doi_tac" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ten_doi_tac" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ma_so_tien_te" character varying(20) NOT NULL DEFAULT 'VND'`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ma_so_vu_viec" character varying(100) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "dk_no" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "dk_co" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ps_no" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ps_co" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ck_no" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ck_co" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "ty_gia_ck" numeric(18,4)`,
    );
    await queryRunner.query(`ALTER TABLE "gw_payables" ADD "period_from" date`);
    await queryRunner.query(`ALTER TABLE "gw_payables" ADD "period_to" date`);
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "data_as_of" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "noi_dung_chi_tiet" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "san_pham_code" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "san_pham_name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "loai_san_pham_code" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "don_vi_tinh_text" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "so_luong_hoa_don" numeric(18,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "don_gia" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "tien_chua_thue" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "thue_suat" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" ADD "tien_co_thue" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ALTER COLUMN "branch_external_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ALTER COLUMN "branch_external_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_gw_receivables_composite_key" ON "gw_receivables" ("branch_external_id", "hd_phieu_dich_vu_id", "so_chung_tu", "period_from", "period_to") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_gw_payables_composite_key" ON "gw_payables" ("branch_external_id", "tai_khoan_id", "doi_tac_id", "ma_so_tien_te", "ma_so_vu_viec", "period_from", "period_to") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_gw_payables_composite_key"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_gw_receivables_composite_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ALTER COLUMN "branch_external_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ALTER COLUMN "branch_external_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "tien_co_thue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "thue_suat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "tien_chua_thue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "don_gia"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "so_luong_hoa_don"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "don_vi_tinh_text"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "loai_san_pham_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "san_pham_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "san_pham_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_case_services" DROP COLUMN "noi_dung_chi_tiet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "data_as_of"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "period_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "period_from"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ty_gia_ck"`,
    );
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "ck_co"`);
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "ck_no"`);
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "ps_co"`);
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "ps_no"`);
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "dk_co"`);
    await queryRunner.query(`ALTER TABLE "gw_payables" DROP COLUMN "dk_no"`);
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ma_so_vu_viec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ma_so_tien_te"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ten_doi_tac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ma_so_doi_tac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "doi_tac_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ten_tai_khoan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "ma_so_tai_khoan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" DROP COLUMN "tai_khoan_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "data_as_of"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "period_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "period_from"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "ngay_phat_sinh"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "tien_da_thanh_toan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "tien_thanh_toan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "bien_so_xe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "khach_hang_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "khach_hang_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "so_chung_tu"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" DROP COLUMN "hd_phieu_dich_vu_id"`,
    );
    await queryRunner.query(`ALTER TABLE "gw_cases" DROP COLUMN "data_as_of"`);
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "ngay_phat_sinh"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "tien_con_phai_thanh_toan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "tien_da_thanh_toan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "tien_co_thue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "ten_tinh_trang_dich_vu"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "tinh_trang_dich_vu"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "khach_hang_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_cases" DROP COLUMN "khach_hang_code"`,
    );
    await queryRunner.query(`ALTER TABLE "gw_cases" DROP COLUMN "bien_so_xe"`);
    await queryRunner.query(`ALTER TABLE "gw_cases" DROP COLUMN "so_chung_tu"`);
    await queryRunner.query(
      `ALTER TABLE "gw_branches" DROP COLUMN "parent_id"`,
    );
    await queryRunner.query(`ALTER TABLE "gw_auth" DROP COLUMN "ss_client_id"`);
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "total_amount" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "external_id" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "code" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_payables" ADD "paid_amount" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "code" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "name" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "paid_amount" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "total_amount" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "gw_receivables" ADD "external_id" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c5c97ed8b4f17b17a30f129eee" ON "gw_payables" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b13a47e28e29e30989b94ae521" ON "gw_payables" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6d16c4a07d47e259eac0be5907" ON "gw_receivables" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5ec1d130bc48f433184606f838" ON "gw_receivables" ("external_id") `,
    );
  }
}
