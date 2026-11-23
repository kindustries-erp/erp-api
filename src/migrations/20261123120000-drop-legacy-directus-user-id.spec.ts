import { QueryRunner } from 'typeorm';
import { DropLegacyDirectusUserId20261123120000 } from './20261123120000-drop-legacy-directus-user-id';

describe('DropLegacyDirectusUserId20261123120000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() bỏ index rồi bỏ cột ở cả hai bảng, chỉ dùng IF EXISTS', async () => {
    const { runner, query } = makeRunner();
    await new DropLegacyDirectusUserId20261123120000().up(runner);
    const sql = sqlOf(query);
    expect(query.mock.calls[0][0]).toContain('DROP INDEX IF EXISTS');
    expect(sql).toContain('"core_users" DROP COLUMN IF EXISTS');
    expect(sql).toContain('"users_management" DROP COLUMN IF EXISTS');
    expect(sql).not.toMatch(/DROP TABLE|DELETE|TRUNCATE/i);
  });

  it('down() tạo lại cột uuid NULL và index, không động vào dữ liệu', async () => {
    const { runner, query } = makeRunner();
    await new DropLegacyDirectusUserId20261123120000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('"legacy_directus_user_id" uuid NULL');
    expect(sql).toContain('idx_core_users_legacy_directus_user_id');
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE/i);
  });
});
