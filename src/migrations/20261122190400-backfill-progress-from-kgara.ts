import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill nhóm tiến độ từ `kgara_cases.raw_data` (khóa PascalCase của KGara) vào `cases_garage`
 * và `source_snapshot`. Ngày KGara là giờ địa phương không kèm múi giờ, đọc theo giờ VN.
 * Chỉ ghi vào cột hiệu lực khi chưa có giá trị (không đè chỉnh sửa của v2).
 */
export class BackfillProgressFromKgara20261122190400 implements MigrationInterface {
  name = 'BackfillProgressFromKgara20261122190400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH src AS (
        SELECT
          k."id",
          (NULLIF(k."raw_data"->>'NgayBatDauSuaChua', '')::timestamp
            AT TIME ZONE 'Asia/Ho_Chi_Minh') AS started_at,
          (NULLIF(k."raw_data"->>'NgayDuKienHoanThanh', '')::timestamp
            AT TIME ZONE 'Asia/Ho_Chi_Minh') AS expected_completion_at,
          NULLIF(k."raw_data"->>'YeuCauDichVu', '') AS request_description,
          NULLIF(k."raw_data"->>'ChanDoan', '') AS diagnosis,
          NULLIF(k."raw_data"->>'NhanVienCoVanDichVuCode', '') AS advisor_code,
          NULLIF(k."raw_data"->>'NhanVienCoVanDichVuName', '') AS advisor_name
        FROM "kgara_cases" k
      )
      UPDATE "cases_garage" c
      SET
        "source_snapshot" = c."source_snapshot" || jsonb_strip_nulls(jsonb_build_object(
          'startedAt', s.started_at,
          'expectedCompletionAt', s.expected_completion_at,
          'requestDescription', s.request_description,
          'diagnosis', s.diagnosis,
          'advisorCode', s.advisor_code,
          'advisorName', s.advisor_name
        )),
        "started_at" = COALESCE(c."started_at", s.started_at),
        "expected_completion_at" = COALESCE(c."expected_completion_at", s.expected_completion_at),
        "request_description" = COALESCE(c."request_description", s.request_description),
        "diagnosis" = COALESCE(c."diagnosis", s.diagnosis),
        "advisor_code" = COALESCE(c."advisor_code", s.advisor_code),
        "advisor_name" = COALESCE(c."advisor_name", s.advisor_name)
      FROM src s
      WHERE s."id" = c."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "cases_garage"
      SET
        "source_snapshot" = "source_snapshot"
          - 'startedAt' - 'expectedCompletionAt' - 'requestDescription'
          - 'diagnosis' - 'advisorCode' - 'advisorName',
        "started_at" = NULL,
        "expected_completion_at" = NULL,
        "request_description" = NULL,
        "diagnosis" = NULL,
        "advisor_code" = NULL,
        "advisor_name" = NULL
    `);
  }
}
