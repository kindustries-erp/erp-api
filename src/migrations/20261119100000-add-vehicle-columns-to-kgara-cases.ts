import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kgara: lưu hãng xe, dòng xe, năm sản xuất thành cột typed trên kgara_cases.
 * Nguồn: list (MaHangSanXuat, TenHdHangSanXuat, MaDongXe, TenHdDongXe) và chi tiết (HoSoPhuongTien).
 * Backfill từ raw_data cho phiếu đã có payload. Idempotent.
 */
export class AddVehicleColumnsToKgaraCases20261119100000 implements MigrationInterface {
  name = 'AddVehicleColumnsToKgaraCases20261119100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "hang_xe_code" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "hang_xe_name" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "dong_xe_code" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "dong_xe_name" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "nam_san_xuat" smallint NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_hang_xe_code" ON "kgara_cases" ("hang_xe_code")`,
    );
    await queryRunner.query(
      `UPDATE "kgara_cases"
          SET "hang_xe_code" = COALESCE("hang_xe_code", NULLIF(BTRIM("raw_data"->>'MaHangSanXuat'), '')),
              "hang_xe_name" = COALESCE("hang_xe_name", NULLIF(BTRIM("raw_data"->>'TenHdHangSanXuat'), ''), NULLIF(BTRIM("raw_data"->'HoSoPhuongTien'->>'ThuongHieuName'), '')),
              "dong_xe_code" = COALESCE("dong_xe_code", NULLIF(BTRIM("raw_data"->>'MaDongXe'), ''), NULLIF(BTRIM("raw_data"->'HoSoPhuongTien'->>'HdDongXeCode'), '')),
              "dong_xe_name" = COALESCE("dong_xe_name", NULLIF(BTRIM("raw_data"->>'TenHdDongXe'), ''), NULLIF(BTRIM("raw_data"->'HoSoPhuongTien'->>'HdDongXeName'), '')),
              "nam_san_xuat" = COALESCE(
                "nam_san_xuat",
                CASE
                  WHEN BTRIM("raw_data"->'HoSoPhuongTien'->>'NamSanXuat') ~ '^(19|20)[0-9]{2}$'
                  THEN BTRIM("raw_data"->'HoSoPhuongTien'->>'NamSanXuat')::smallint
                END
              )
        WHERE "raw_data" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_hang_xe_code"`,
    );
    for (const col of [
      'nam_san_xuat',
      'dong_xe_name',
      'dong_xe_code',
      'hang_xe_name',
      'hang_xe_code',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "${col}"`,
      );
    }
  }
}
