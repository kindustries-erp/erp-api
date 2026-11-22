import { QueryRunner } from 'typeorm';
import { CreateBranchesManagementExternalLinks20261118100100 } from './20261118100100-create-branches-management-external-links';

describe('CreateBranchesManagementExternalLinks20261118100100', () => {
  const make = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() tạo bảng liên kết và branch_id nullable + FK + index ở 3 bảng garage', async () => {
    const { runner, query } = make();
    await new CreateBranchesManagementExternalLinks20261118100100().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('CREATE TABLE "branches_management_external_links"');
    expect(sql).toContain('"UQ_branches_management_external_links_active"');
    expect(sql).toContain('WHERE "is_deleted" = false');
    for (const t of [
      'debts_garage',
      'debt_allocations_garage',
      'cashflow_vouchers_garage',
    ]) {
      expect(sql).toContain(
        `ALTER TABLE "${t}" ADD COLUMN "branch_id" uuid NULL`,
      );
      expect(sql).toContain(`"FK_${t}_branch_id"`);
    }
    expect(sql).not.toContain('branch_external_id');
  });

  it('down() gỡ cột và bảng theo thứ tự ngược', async () => {
    const { runner, query } = make();
    await new CreateBranchesManagementExternalLinks20261118100100().down(
      runner,
    );
    const sql = sqlOf(query);
    expect(sql).toContain('DROP TABLE "branches_management_external_links"');
    expect(sql.indexOf('DROP COLUMN "branch_id"')).toBeLessThan(
      sql.indexOf('DROP TABLE'),
    );
  });
});
