import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `core_roles` -> `rbac_roles`, `core_permissions` -> `rbac_permissions`: đổi tên bảng
 * kèm PK/unique/index/FK. Dữ liệu và quan hệ giữ nguyên (FK của `rbac_user_roles`
 * trỏ theo OID nên tự theo bảng mới). Không đổi kiểu cột.
 */
export class RenameCoreRbacTables20261123110000 implements MigrationInterface {
  name = 'RenameCoreRbacTables20261123110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core_roles" RENAME TO "rbac_roles"`);
    await queryRunner.query(
      `ALTER TABLE "core_permissions" RENAME TO "rbac_permissions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_roles" RENAME CONSTRAINT "PK_98be4141aad39680e7e96029732" TO "PK_rbac_roles_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_roles" RENAME CONSTRAINT "UQ_61274cc6ac662edaf9151f7081c" TO "UQ_rbac_roles_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_permissions" RENAME CONSTRAINT "PK_e0e245908c7db1dcdd9eb3cf74f" TO "PK_rbac_permissions_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_ad13c868bb37da55701dfe7c1c" RENAME TO "UQ_rbac_permissions_role_resource_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_permissions" RENAME CONSTRAINT "FK_97d89af85663e6adab50e248fe1" TO "FK_rbac_permissions_role_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rbac_permissions" RENAME CONSTRAINT "FK_rbac_permissions_role_id" TO "FK_97d89af85663e6adab50e248fe1"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_rbac_permissions_role_resource_action" RENAME TO "IDX_ad13c868bb37da55701dfe7c1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_permissions" RENAME CONSTRAINT "PK_rbac_permissions_id" TO "PK_e0e245908c7db1dcdd9eb3cf74f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_roles" RENAME CONSTRAINT "UQ_rbac_roles_name" TO "UQ_61274cc6ac662edaf9151f7081c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_roles" RENAME CONSTRAINT "PK_rbac_roles_id" TO "PK_98be4141aad39680e7e96029732"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rbac_permissions" RENAME TO "core_permissions"`,
    );
    await queryRunner.query(`ALTER TABLE "rbac_roles" RENAME TO "core_roles"`);
  }
}
