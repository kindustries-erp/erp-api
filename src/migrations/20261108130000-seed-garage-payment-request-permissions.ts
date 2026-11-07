import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Resource mới `garage_payment_requests` (đề nghị thanh toán Garage).
 * Cấp đúng các action mà role đang có trên `garage_cashflow`, vì DNTT là một phần của
 * dòng tiền xưởng. Chỉ thêm bản ghi còn thiếu (NOT EXISTS). down() xóa đúng resource này.
 */
export class SeedGaragePaymentRequestPermissions20261108130000 implements MigrationInterface {
  name = 'SeedGaragePaymentRequestPermissions20261108130000';

  private readonly target = 'garage_payment_requests';
  private readonly source = 'garage_cashflow';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "core_permissions" (
        "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
      )
      SELECT uuid_generate_v4(), p."role_id", CAST($1 AS varchar), p."action", p."conditions", now(), now()
      FROM "core_permissions" p
      WHERE p."resource" = CAST($2 AS varchar)
        AND NOT EXISTS (
          SELECT 1 FROM "core_permissions" t
          WHERE t."role_id" = p."role_id"
            AND t."resource" = CAST($1 AS varchar)
            AND t."action" = p."action"
        )
      `,
      [this.target, this.source],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" = $1`,
      [this.target],
    );
  }
}
