import { QueryRunner } from 'typeorm';
import { ReconcileUsersManagement20261115110100 } from './20261115110100-reconcile-users-management';

describe('ReconcileUsersManagement20261115110100', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue([]);
    return { runner: { query } as unknown as QueryRunner, query };
  };

  it('up() chạy 3 câu: thêm thiếu, cập nhật lệch, kiểm tra còn lệch', async () => {
    const { runner, query } = makeRunner();
    await new ReconcileUsersManagement20261115110100().up(runner);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toContain('INSERT INTO "users_management"');
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT DO NOTHING');
    expect(query.mock.calls[0][0]).toContain(`AT TIME ZONE 'UTC'`);
    expect(query.mock.calls[1][0]).toContain('UPDATE "users_management" um');
    expect(query.mock.calls[1][0]).toContain('IS DISTINCT FROM');
  });

  it('up() giữ email/nhân viên cũ khi sẽ vi phạm unique hoặc FK', async () => {
    const { runner, query } = makeRunner();
    await new ReconcileUsersManagement20261115110100().up(runner);
    const sql = query.mock.calls[1][0] as string;
    expect(sql).toContain('ELSE um."email" END');
    expect(sql).toContain('ELSE um."employee_id" END');
    expect(sql).toContain('FROM "erp_employees" e');
  });

  it('up() không ghi vào core_users', async () => {
    const { runner, query } = makeRunner();
    await new ReconcileUsersManagement20261115110100().up(runner);
    const all = query.mock.calls.map((c) => c[0] as string).join('\n');
    expect(all).not.toMatch(/(INSERT INTO|UPDATE|DELETE FROM) "core_users"/);
  });

  it('up() báo lỗi và liệt kê id khi còn dòng lệch', async () => {
    const { runner, query } = makeRunner();
    query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 'u-bad' }]);
    await expect(
      new ReconcileUsersManagement20261115110100().up(runner),
    ).rejects.toThrow(/u-bad/);
  });

  it('down() không chạy câu lệnh nào', async () => {
    const { runner, query } = makeRunner();
    await new ReconcileUsersManagement20261115110100().down(runner);
    expect(query).not.toHaveBeenCalled();
  });
});
