import { MigrationInterface, QueryRunner } from 'typeorm';

export class KgaraTableRenameAndCleanup1782922535286 implements MigrationInterface {
  name = 'KgaraTableRenameAndCleanup1782922535286';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_case_payments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_case_services" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_cases" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_receivables" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_payables" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_sync_runs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_branches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gw_auth" CASCADE`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."gw_sync_runs_status_enum" CASCADE`,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_auth" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "access_token" text, "refresh_token" text, "token_expires" TIMESTAMP, "ss_client_id" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7da11c78acc32547ece9f9dcad8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "external_id" character varying(100) NOT NULL, "code" character varying(100), "name" character varying(255), "parent_id" character varying(100), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a455c06de9f3d2567c8b9d8ae6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0b4e59743700570a7ecb1ebf61" ON "kgara_branches" ("external_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_cases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hd_phieu_dich_vu_id" character varying(100) NOT NULL, "so_chung_tu" character varying(100), "bien_so_xe" character varying(50), "khach_hang_code" character varying(100), "khach_hang_name" character varying(255), "tinh_trang_dich_vu" integer, "ten_tinh_trang_dich_vu" character varying(100), "tien_co_thue" numeric(18,2), "tien_da_thanh_toan" numeric(18,2), "tien_con_phai_thanh_toan" numeric(18,2), "ngay_phat_sinh" TIMESTAMP, "data_as_of" TIMESTAMP WITH TIME ZONE, "branch_external_id" character varying(100), "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60212c6dea56b5e30e4e73cc142" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_46eb0477a216afa4e843216379" ON "kgara_cases" ("hd_phieu_dich_vu_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd29ecc1ab8a059a0e786bbfe2" ON "kgara_cases" ("branch_external_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_receivables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_external_id" character varying(100) NOT NULL, "hd_phieu_dich_vu_id" character varying(100) NOT NULL, "so_chung_tu" character varying(100), "khach_hang_code" character varying(100), "khach_hang_name" character varying(255), "bien_so_xe" character varying(50), "tien_thanh_toan" numeric(18,2), "tien_da_thanh_toan" numeric(18,2), "ngay_phat_sinh" TIMESTAMP, "period_from" date, "period_to" date, "data_as_of" TIMESTAMP WITH TIME ZONE, "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_15aabdc367b3541a84dcccd1413" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_kgara_receivables_composite_key" ON "kgara_receivables" ("branch_external_id", "hd_phieu_dich_vu_id", "so_chung_tu", "period_from", "period_to") `,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_payables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_external_id" character varying(100) NOT NULL, "tai_khoan_id" character varying(100) NOT NULL, "ma_so_tai_khoan" character varying(50), "ten_tai_khoan" character varying(255), "doi_tac_id" character varying(100) NOT NULL, "ma_so_doi_tac" character varying(100), "ten_doi_tac" character varying(255), "ma_so_tien_te" character varying(20) NOT NULL DEFAULT 'VND', "ma_so_vu_viec" character varying(100) NOT NULL DEFAULT '', "dk_no" numeric(18,2), "dk_co" numeric(18,2), "ps_no" numeric(18,2), "ps_co" numeric(18,2), "ck_no" numeric(18,2), "ck_co" numeric(18,2), "ty_gia_ck" numeric(18,4), "period_from" date, "period_to" date, "data_as_of" TIMESTAMP WITH TIME ZONE, "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_881c5ac4f3f998536e83b677807" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_kgara_payables_composite_key" ON "kgara_payables" ("branch_external_id", "tai_khoan_id", "doi_tac_id", "ma_so_tien_te", "ma_so_vu_viec", "period_from", "period_to") `,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_case_services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hd_phieu_dich_vu_chi_tiet_id" character varying(100) NOT NULL, "hd_phieu_dich_vu_id" character varying(100) NOT NULL, "noi_dung_chi_tiet" text, "san_pham_code" character varying(100), "san_pham_name" character varying(255), "loai_san_pham_code" character varying(50), "don_vi_tinh_text" character varying(50), "so_luong_hoa_don" numeric(18,4), "don_gia" numeric(18,2), "tien_chua_thue" numeric(18,2), "thue_suat" numeric(5,2), "tien_co_thue" numeric(18,2), "raw_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9ee356875d5d68399233c8cdb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_44ea8c16b29ff083c62febd964" ON "kgara_case_services" ("hd_phieu_dich_vu_chi_tiet_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5365d8d0781a1d363185aea945" ON "kgara_case_services" ("hd_phieu_dich_vu_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."kgara_sync_runs_status_enum" AS ENUM('SUCCESS', 'FAILED', 'PARTIAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "kgara_sync_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_external_id" character varying(100), "endpoint" character varying(255) NOT NULL, "query_params" jsonb, "page_size" integer, "request_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_ended_at" TIMESTAMP WITH TIME ZONE, "response_status" integer, "response_message" text, "data_as_of" TIMESTAMP WITH TIME ZONE, "row_count" integer NOT NULL DEFAULT '0', "error_message" text, "status" "public"."kgara_sync_runs_status_enum" NOT NULL DEFAULT 'SUCCESS', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e556753a959ef1f81f9004504d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68f95584f3a10dcd68d0a86483" ON "kgara_sync_runs" ("branch_external_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_68f95584f3a10dcd68d0a86483"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_sync_runs"`);
    await queryRunner.query(`DROP TYPE "public"."kgara_sync_runs_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5365d8d0781a1d363185aea945"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_44ea8c16b29ff083c62febd964"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_case_services"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_kgara_payables_composite_key"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_payables"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_kgara_receivables_composite_key"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_receivables"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bd29ecc1ab8a059a0e786bbfe2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46eb0477a216afa4e843216379"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_cases"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0b4e59743700570a7ecb1ebf61"`,
    );
    await queryRunner.query(`DROP TABLE "kgara_branches"`);
    await queryRunner.query(`DROP TABLE "kgara_auth"`);
  }
}
