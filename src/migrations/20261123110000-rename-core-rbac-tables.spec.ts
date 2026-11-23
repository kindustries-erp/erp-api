import { QueryRunner } from 'typeorm';
import { RenameCoreRbacTables20261123110000 } from './20261123110000-rename-core-rbac-tables';

describe('RenameCoreRbacTables20261123110000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string);

  it('up() đổi tên 2 bảng trước rồi mới đổi ràng buộc/index, không động vào dữ liệu', async () => {
    const { runner, query } = makeRunner();
    await new RenameCoreRbacTables20261123110000().up(runner);
    const sql = sqlOf(query);
    expect(sql[0]).toContain('"core_roles" RENAME TO "rbac_roles"');
    expect(sql[1]).toContain('"core_permissions" RENAME TO "rbac_permissions"');
    const all = sql.join('\n');
    expect(all).toContain('FK_rbac_permissions_role_id');
    expect(all).toContain('UQ_rbac_permissions_role_resource_action');
    expect(all).not.toMatch(/DROP|DELETE|UPDATE|ALTER COLUMN/i);
  });

  it('down() hoàn tác đúng tên cũ, đổi tên bảng ở cuối', async () => {
    const { runner, query } = makeRunner();
    await new RenameCoreRbacTables20261123110000().down(runner);
    const sql = sqlOf(query);
    expect(sql.join('\n')).toContain('"FK_97d89af85663e6adab50e248fe1"');
    expect(sql[sql.length - 2]).toContain(
      '"rbac_permissions" RENAME TO "core_permissions"',
    );
    expect(sql[sql.length - 1]).toContain(
      '"rbac_roles" RENAME TO "core_roles"',
    );
  });

  it('up() rồi down() dùng cùng số lệnh', async () => {
    const a = makeRunner();
    const b = makeRunner();
    const m = new RenameCoreRbacTables20261123110000();
    await m.up(a.runner);
    await m.down(b.runner);
    expect(a.query).toHaveBeenCalledTimes(b.query.mock.calls.length);
  });
});
