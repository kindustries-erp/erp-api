import { QueryRunner } from 'typeorm';
import { CreateAuthSessions20261115110000 } from './20261115110000-create-auth-sessions';

describe('CreateAuthSessions20261115110000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };

  it('up() tạo bảng với timestamptz, FK users_management và CASCADE', async () => {
    const { runner, query } = makeRunner();
    await new CreateAuthSessions20261115110000().up(runner);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "auth_sessions"');
    expect(sql).toContain('REFERENCES "users_management"("id")');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain('"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL');
    expect(sql).toContain('"is_deleted" boolean');
    expect(sql).not.toMatch(/TIMESTAMP (?!WITH TIME ZONE)/);
  });

  it('up() tạo unique token_hash và index user_id, expires_at (IF NOT EXISTS)', async () => {
    const { runner, query } = makeRunner();
    await new CreateAuthSessions20261115110000().up(runner);
    const all = query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(all).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_auth_sessions_token_hash"',
    );
    expect(all).toContain('"IDX_auth_sessions_user_id"');
    expect(all).toContain('"IDX_auth_sessions_expires_at"');
  });

  it('up() không đụng core_refresh_tokens / core_users', async () => {
    const { runner, query } = makeRunner();
    await new CreateAuthSessions20261115110000().up(runner);
    const all = query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(all).not.toContain('core_refresh_tokens');
    expect(all).not.toContain('core_users');
  });

  it('down() chỉ xóa auth_sessions', async () => {
    const { runner, query } = makeRunner();
    await new CreateAuthSessions20261115110000().down(runner);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBe('DROP TABLE IF EXISTS "auth_sessions"');
  });
});
