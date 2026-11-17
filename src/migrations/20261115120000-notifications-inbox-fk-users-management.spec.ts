import { QueryRunner } from 'typeorm';
import { NotificationsInboxFkUsersManagement20261115120000 } from './20261115120000-notifications-inbox-fk-users-management';

describe('NotificationsInboxFkUsersManagement20261115120000', () => {
  const makeRunner = (orphans = '0') => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ n: orphans }])
      .mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() đổi FK sang users_management với CASCADE', async () => {
    const { runner, query } = makeRunner();
    await new NotificationsInboxFkUsersManagement20261115120000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('REFERENCES "users_management"("id")');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).not.toContain('REFERENCES "core_users"');
  });

  it('up() từ chối khi còn dòng mồ côi và không đổi FK', async () => {
    const { runner, query } = makeRunner('3');
    await expect(
      new NotificationsInboxFkUsersManagement20261115120000().up(runner),
    ).rejects.toThrow(/3 dòng/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('down() trả FK về core_users', async () => {
    const { runner, query } = makeRunner();
    await new NotificationsInboxFkUsersManagement20261115120000().down(runner);
    expect(sqlOf(query)).toContain('REFERENCES "core_users"("id")');
  });
});
