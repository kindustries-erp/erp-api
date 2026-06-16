import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountingPermissions20260617060000 implements MigrationInterface {
  name = 'AddAccountingPermissions20260617060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const permissions = [
      { action: 'read', resource: 'journal_entries' },
      { action: 'create', resource: 'journal_entries' },
      { action: 'update', resource: 'journal_entries' },
      { action: 'manage', resource: 'accounting_configs' },
    ];

    const adminRole = await queryRunner.query(
      `SELECT id FROM core_roles WHERE name = 'Admin' LIMIT 1`,
    );
    if (adminRole && adminRole.length > 0) {
      const roleId = adminRole[0].id;
      for (const p of permissions) {
        await queryRunner.query(`
          INSERT INTO core_permissions (id, role_id, resource, action)
          VALUES (gen_random_uuid(), '${roleId}', '${p.resource}', '${p.action}')
          ON CONFLICT (role_id, resource, action) DO NOTHING;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM core_permissions 
      WHERE resource IN ('journal_entries', 'accounting_configs')
    `);
  }
}
