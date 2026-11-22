import { QueryRunner } from 'typeorm';
import { RenameNotificationsCoreToInbox20261109150000 } from './20261109150000-rename-notifications-core-to-inbox';

/** Giả lập QueryRunner: `to_regclass` trả theo bảng có sẵn, các lệnh khác chỉ ghi lại. */
function makeRunner(existing: string[]) {
  const calls: string[] = [];
  const runner = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push(sql);
      if (sql.includes('to_regclass')) {
        const table = String(params?.[0]).replace('public.', '');
        return [
          {
            [sql.includes(' AS src') ? 'src' : 'dst']: existing.includes(table)
              ? table
              : null,
          },
        ];
      }
      return [];
    }),
  };
  return {
    runner: runner as unknown as QueryRunner,
    calls,
    query: runner.query,
  };
}

describe('RenameNotificationsCoreToInbox20261109150000', () => {
  const migration = new RenameNotificationsCoreToInbox20261109150000();

  it('up đổi bảng, index, PK và FK sang tên *_inbox', async () => {
    const { runner, calls } = makeRunner(['notifications_core']);

    await migration.up(runner);

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'ALTER TABLE "notifications_core" RENAME TO "notifications_inbox"',
        ),
        expect.stringContaining(
          'ALTER INDEX IF EXISTS "IDX_notifications_core_user_list" RENAME TO "IDX_notifications_inbox_user_list"',
        ),
        expect.stringContaining(
          'RENAME CONSTRAINT "PK_notifications_core_id" TO "PK_notifications_inbox_id"',
        ),
        expect.stringContaining(
          'RENAME CONSTRAINT "FK_notifications_core_user_id" TO "FK_notifications_inbox_user_id"',
        ),
      ]),
    );
  });

  it('up bỏ qua khi không có bảng nguồn (môi trường mới)', async () => {
    const { runner, calls } = makeRunner([]);

    await migration.up(runner);

    expect(calls.some((c) => c.includes('RENAME TO'))).toBe(false);
  });

  it('up báo lỗi khi bảng đích đã tồn tại, không đổi tên gì', async () => {
    const { runner, calls } = makeRunner([
      'notifications_core',
      'notifications_inbox',
    ]);

    await expect(migration.up(runner)).rejects.toThrow('đã tồn tại');
    expect(calls.some((c) => c.includes('RENAME TO'))).toBe(false);
  });

  it('down đảo chiều: notifications_inbox về notifications_core', async () => {
    const { runner, calls } = makeRunner(['notifications_inbox']);

    await migration.down(runner);

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'ALTER TABLE "notifications_inbox" RENAME TO "notifications_core"',
        ),
      ]),
    );
  });
});
