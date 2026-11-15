import { QueryRunner } from 'typeorm';
import { BackfillUsersManagement20261115100100 } from './20261115100100-backfill-users-management';

describe('BackfillUsersManagement20261115100100', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue([]);
    return { runner: { query } as unknown as QueryRunner, query };
  };

  it('up() copy từ core_users, giữ id, chuẩn hóa email và cast timestamp sang timestamptz', async () => {
    const { runner, query } = makeRunner();
    await new BackfillUsersManagement20261115100100().up(runner);

    expect(query).toHaveBeenCalledTimes(2);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO "users_management"');
    expect(sql).toContain('FROM "core_users" cu');
    expect(sql).toContain('cu."id"');
    expect(sql).toContain('lower(trim(cu."email"))');
    expect(sql).toContain(`AT TIME ZONE 'UTC'`);
    expect(sql).not.toContain('current_setting');
  });

  it('up() chỉ giữ employee_id khi nhân viên còn tồn tại', async () => {
    const { runner, query } = makeRunner();
    await new BackfillUsersManagement20261115100100().up(runner);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('LEFT JOIN "erp_employees" emp');
    expect(sql).toMatch(/CASE WHEN emp\."id" IS NULL THEN NULL/);
  });

  it('up() bỏ qua dòng trùng (chạy lại an toàn)', async () => {
    const { runner, query } = makeRunner();
    await new BackfillUsersManagement20261115100100().up(runner);

    expect(query.mock.calls[0][0]).toContain('ON CONFLICT DO NOTHING');
  });

  it('up() báo lỗi và liệt kê id khi còn tài khoản không được backfill', async () => {
    const { runner, query } = makeRunner();
    query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 'u-missing' }]);
    await expect(
      new BackfillUsersManagement20261115100100().up(runner),
    ).rejects.toThrow(/u-missing/);
  });

  it('down() không chạy câu lệnh nào (không xóa dữ liệu, không đụng core_users)', async () => {
    const { runner, query } = makeRunner();
    await new BackfillUsersManagement20261115100100().down(runner);

    expect(query).not.toHaveBeenCalled();
  });
});
