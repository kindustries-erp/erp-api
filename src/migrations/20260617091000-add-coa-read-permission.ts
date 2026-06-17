import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoaReadPermission20260617091000 implements MigrationInterface {
  name = 'AddCoaReadPermission20260617091000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adminRole = await queryRunner.query(
      `SELECT id FROM core_roles WHERE name = 'Admin' LIMIT 1`,
    );
    if (adminRole && adminRole.length > 0) {
      const roleId = adminRole[0].id;
      // Add read permission for accounting_configs (needed for chart-of-accounts)
      await queryRunner.query(`
        INSERT INTO core_permissions (id, role_id, resource, action)
        VALUES (gen_random_uuid(), '${roleId}', 'accounting_configs', 'read')
        ON CONFLICT (role_id, resource, action) DO NOTHING;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM core_permissions
      WHERE resource = 'accounting_configs' AND action = 'read'
    `);
  }
}
