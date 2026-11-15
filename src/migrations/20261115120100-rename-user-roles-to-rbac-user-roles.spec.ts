import { QueryRunner } from 'typeorm';
import { RenameUserRolesToRbacUserRoles20261115120100 } from './20261115120100-rename-user-roles-to-rbac-user-roles';

describe('RenameUserRolesToRbacUserRoles20261115120100', () => {
  const makeRunner = (orphans = '0') => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ n: orphans }])
      .mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() đổi tên bảng, FK user sang users_management, created_at timestamptz', async () => {
    const { runner, query } = makeRunner();
    await new RenameUserRolesToRbacUserRoles20261115120100().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('RENAME TO "rbac_user_roles"');
    expect(sql).toContain('REFERENCES "users_management"("id")');
    expect(sql).toContain('TYPE TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).not.toContain('is_deleted');
  });

  it('up() từ chối khi còn dòng mồ côi và chưa đổi tên', async () => {
    const { runner, query } = makeRunner('2');
    await expect(
      new RenameUserRolesToRbacUserRoles20261115120100().up(runner),
    ).rejects.toThrow(/2 dòng/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('down() trả tên bảng, FK core_users và created_at không múi giờ', async () => {
    const { runner, query } = makeRunner();
    await new RenameUserRolesToRbacUserRoles20261115120100().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('RENAME TO "core_user_roles"');
    expect(sql).toContain('REFERENCES "core_users"("id")');
    expect(sql).toContain('TYPE TIMESTAMP WITHOUT TIME ZONE');
  });
});
