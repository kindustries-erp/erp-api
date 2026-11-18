import { QueryRunner } from 'typeorm';
import { RenameErpBranchesToBranchesManagement20261118100000 } from './20261118100000-rename-erp-branches-to-branches-management';

describe('RenameErpBranchesToBranchesManagement20261118100000', () => {
  const makeRunner = (first: unknown) => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() đổi tên bảng, thêm is_deleted, unique một phần, timestamptz và view tương thích', async () => {
    const { runner, query } = makeRunner([{ t: null }]);
    await new RenameErpBranchesToBranchesManagement20261118100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('RENAME TO "branches_management"');
    expect(sql).toContain(
      'ADD COLUMN "is_deleted" boolean NOT NULL DEFAULT false',
    );
    expect(sql).toContain('"UQ_branches_management_code_active"');
    expect(sql).toContain('WHERE "is_deleted" = false');
    expect(sql).toContain('TYPE TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain(`AT TIME ZONE 'UTC'`);
    expect(sql).toContain('CREATE VIEW "erp_branches"');
    expect(sql).not.toMatch(/DROP TABLE/);
    // View tạo sau cùng để không chặn ALTER kiểu cột
    expect(sql.indexOf('CREATE VIEW')).toBeGreaterThan(
      sql.indexOf('TYPE TIMESTAMP WITH TIME ZONE'),
    );
  });

  it('up() dừng khi branches_management đã tồn tại, không đổi gì', async () => {
    const { runner, query } = makeRunner([{ t: 'branches_management' }]);
    await expect(
      new RenameErpBranchesToBranchesManagement20261118100000().up(runner),
    ).rejects.toThrow(/đã tồn tại/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('down() từ chối khi còn dòng xóa mềm', async () => {
    const { runner, query } = makeRunner([{ n: '2' }]);
    await expect(
      new RenameErpBranchesToBranchesManagement20261118100000().down(runner),
    ).rejects.toThrow(/2 dòng xóa mềm/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('down() bỏ view, trả kiểu cột, unique cũ và tên bảng', async () => {
    const { runner, query } = makeRunner([{ n: '0' }]);
    await new RenameErpBranchesToBranchesManagement20261118100000().down(
      runner,
    );
    const sql = sqlOf(query);
    expect(sql).toContain('DROP VIEW "erp_branches"');
    expect(sql).toContain('TYPE TIMESTAMP WITHOUT TIME ZONE');
    expect(sql).toContain('"IDX_759b04bed2a84a7feb09baad57"');
    expect(sql).toContain('DROP COLUMN "is_deleted"');
    expect(sql).toContain('RENAME TO "erp_branches"');
  });
});
