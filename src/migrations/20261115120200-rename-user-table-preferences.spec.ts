import { QueryRunner } from 'typeorm';
import { RenameUserTablePreferences20261115120200 } from './20261115120200-rename-user-table-preferences';

describe('RenameUserTablePreferences20261115120200', () => {
  const makeRunner = (orphans = '0') => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ n: orphans }])
      .mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() đổi tên, FK users_management, thêm is_deleted và extra_data có CHECK object', async () => {
    const { runner, query } = makeRunner();
    await new RenameUserTablePreferences20261115120200().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('RENAME TO "table_preferences"');
    expect(sql).toContain('REFERENCES "users_management"("id")');
    expect(sql).toContain('"is_deleted" boolean NOT NULL DEFAULT false');
    expect(sql).toContain('"extra_data" jsonb NOT NULL');
    expect(sql).toContain('jsonb_typeof("extra_data") = \'object\'');
  });

  it('up() từ chối khi còn dòng mồ côi và chưa đổi tên', async () => {
    const { runner, query } = makeRunner('1');
    await expect(
      new RenameUserTablePreferences20261115120200().up(runner),
    ).rejects.toThrow(/1 dòng/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('down() gỡ cột thêm, trả FK core_users và tên cũ', async () => {
    const { runner, query } = makeRunner();
    await new RenameUserTablePreferences20261115120200().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('DROP COLUMN IF EXISTS "extra_data"');
    expect(sql).toContain('REFERENCES "core_users"("id")');
    expect(sql).toContain('RENAME TO "core_user_table_preferences"');
  });
});
