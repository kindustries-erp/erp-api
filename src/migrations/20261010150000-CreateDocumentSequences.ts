import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE = 'erp_document_sequences';
const INDEX = 'uq_erp_document_sequences_prefix_period_branch';
const CREATED_BY_COMMENT =
  'created-by-migration: CreateDocumentSequences20261010150000';

/**
 * Bộ đếm số chứng từ nguyên tử (AccountingCoreService.generateEntryNo):
 *   INSERT ... ON CONFLICT (prefix, period, COALESCE(branch_id, '000…'::uuid)) DO UPDATE ...
 * nên BẮT BUỘC có unique index theo biểu thức COALESCE(branch_id, …).
 *
 * Idempotent và an toàn với DB đã có bảng (greenway-*): khi bảng đã tồn tại thì chỉ bảo đảm index,
 * KHÔNG seed lại và KHÔNG sửa bộ đếm đang chạy.
 */
export class CreateDocumentSequences20261010150000 implements MigrationInterface {
  name = 'CreateDocumentSequences20261010150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existedBefore = await queryRunner.hasTable(TABLE);

    if (!existedBefore) {
      await queryRunner.query(`
        CREATE TABLE ${TABLE} (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          prefix varchar(32) NOT NULL,
          period varchar(16) NOT NULL,
          branch_id uuid NULL,
          current_value integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT ${TABLE}_pkey PRIMARY KEY (id)
        );
      `);
      await queryRunner.query(
        `COMMENT ON TABLE ${TABLE} IS '${CREATED_BY_COMMENT}'`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX}
        ON ${TABLE} (prefix, period, (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)));
    `);

    // Index trùng tên nhưng khác định nghĩa (vd index 3 cột thường do entity khai báo) sẽ làm upsert lỗi:
    // dừng và báo thay vì tự drop.
    const defs: Array<{ indexdef: string }> = await queryRunner.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2`,
      [TABLE, INDEX],
    );
    if (!defs.length || !/COALESCE\s*\(\s*branch_id/i.test(defs[0].indexdef)) {
      throw new Error(
        `Index ${INDEX} trên ${TABLE} tồn tại nhưng không phải unique index theo biểu thức COALESCE(branch_id, …). ` +
          `Hãy xử lý thủ công (DROP INDEX rồi chạy lại) — migration không tự xóa index.`,
      );
    }

    if (!existedBefore) {
      // Seed từ số đã cấp theo định dạng chuẩn PREFIX-YYYYMMDD-0001 để bộ đếm không cấp trùng số cũ.
      await queryRunner.query(`
        INSERT INTO ${TABLE} (prefix, period, branch_id, current_value, updated_at)
        SELECT split_part(entry_no, '-', 1),
               split_part(entry_no, '-', 2),
               branch_id,
               MAX(split_part(entry_no, '-', 3)::int),
               NOW()
          FROM erp_journal_entries
         WHERE entry_no ~ '^[^-]+-[0-9]{8}-[0-9]{4}$'
         GROUP BY 1, 2, 3
        ON CONFLICT (prefix, period, (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)))
        DO UPDATE SET current_value = GREATEST(${TABLE}.current_value, EXCLUDED.current_value),
                      updated_at = NOW();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Chỉ gỡ khi bảng do chính migration này tạo; DB có sẵn bảng (greenway-*) thì giữ nguyên dữ liệu.
    const rows: Array<{ comment: string | null }> = await queryRunner.query(
      `SELECT obj_description(to_regclass('public.${TABLE}'), 'pg_class') AS comment`,
    );
    if (rows[0]?.comment === CREATED_BY_COMMENT) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${TABLE}`);
    }
  }
}
