import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `core_user_roles` -> `rbac_user_roles`: đổi tên bảng/PK/unique/FK, `created_at`
 * sang timestamptz (giữ giá trị: cột cũ lưu giờ UTC của server), FK user -> `users_management`.
 * Giữ xóa cứng (không thêm is_deleted), theo thiết kế của lõi rbac-core.
 */
export class RenameUserRolesToRbacUserRoles20261115120100 implements MigrationInterface {
  name = 'RenameUserRolesToRbacUserRoles20261115120100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphans: Array<{ n: string }> = await queryRunner.query(
      `SELECT count(*)::text AS n FROM "core_user_roles" t
       WHERE NOT EXISTS (SELECT 1 FROM "users_management" u WHERE u."id" = t."user_id")`,
    );
    if (Number(orphans[0]?.n ?? 0) > 0) {
      throw new Error(
        `core_user_roles còn ${orphans[0].n} dòng user_id không có trong users_management`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "core_user_roles" RENAME TO "rbac_user_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" RENAME CONSTRAINT "PK_a72e31234a755d00ee7f5646864" TO "PK_rbac_user_roles_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_74f996ff707c3614369abcecf2" RENAME TO "UQ_rbac_user_roles_user_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" RENAME CONSTRAINT "FK_536b65840609beb90d1291a2f61" TO "FK_rbac_user_roles_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" DROP CONSTRAINT "FK_5def06b0309c7b6775a0cf55920"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "FK_rbac_user_roles_user_id"
       FOREIGN KEY ("user_id") REFERENCES "users_management"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE
       USING "created_at" AT TIME ZONE 'UTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" ALTER COLUMN "created_at" TYPE TIMESTAMP WITHOUT TIME ZONE
       USING "created_at" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" DROP CONSTRAINT "FK_rbac_user_roles_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "FK_5def06b0309c7b6775a0cf55920"
       FOREIGN KEY ("user_id") REFERENCES "core_users"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" RENAME CONSTRAINT "FK_rbac_user_roles_role_id" TO "FK_536b65840609beb90d1291a2f61"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_rbac_user_roles_user_role" RENAME TO "IDX_74f996ff707c3614369abcecf2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" RENAME CONSTRAINT "PK_rbac_user_roles_id" TO "PK_a72e31234a755d00ee7f5646864"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_user_roles" RENAME TO "core_user_roles"`,
    );
  }
}
