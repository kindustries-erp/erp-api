import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Index cho công nợ garage v2 và kgara cases v2 (Gate 0 trên erp_greenway_staging, 2026-11-16).
 *
 * Chỉ thêm index còn thiếu; mọi câu lệnh idempotent.
 * - kgara_case_linked_invoice: chỉ có PK, tra theo "caseDbId" / "invoiceId" đang Seq Scan.
 * - kgara_cases(so_chung_tu): khóa join sang kgara_gross_profit.vu_viec_code, chưa có index.
 *
 * Không đụng 2 unique index trùng trên kgara_gross_profit(hd_phieu_dich_vu_id);
 * việc gỡ chúng cần duyệt riêng.
 */
export class GarageDebtsV2Indexes1794832200000 implements MigrationInterface {
  name = 'GarageDebtsV2Indexes1794832200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_kgara_case_linked_invoice_case_db_id"
        ON "kgara_case_linked_invoice" ("caseDbId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_kgara_case_linked_invoice_invoice_id"
        ON "kgara_case_linked_invoice" ("invoiceId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_so_chung_tu"
        ON "kgara_cases" ("so_chung_tu");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_so_chung_tu";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_case_linked_invoice_invoice_id";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_case_linked_invoice_case_db_id";`,
    );
  }
}
