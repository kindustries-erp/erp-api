import { QueryRunner } from 'typeorm';
import { KgaraBranchToPhoQuang20261126110000 } from './20261126110000-kgara-branch-to-pho-quang';

describe('KgaraBranchToPhoQuang20261126110000', () => {
  const makeRunner = (rows: unknown[] = []) => {
    const query = jest.fn(() => Promise.resolve(rows));
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');

  it('up() tìm PQ, GR, GN theo mã và chỉ đổi khi có PQ', async () => {
    const { runner, query } = makeRunner();
    await new KgaraBranchToPhoQuang20261126110000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`WHERE "code" = 'PQ' AND "is_deleted" = false`);
    expect(sql).toContain(
      `WHERE "code" IN ('GR', 'GN') AND "is_deleted" = false`,
    );
    expect(sql).toContain('EXISTS (SELECT 1 FROM pq)');
  });

  it.each([
    'cases_garage',
    'debts_garage',
    'debt_allocations_garage',
    'branches_management_external_links',
  ])('up() sao lưu rồi chuyển branch_id của %s sang PQ', async (t) => {
    const { runner, query } = makeRunner();
    await new KgaraBranchToPhoQuang20261126110000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`SELECT '${t}', x."id", x."branch_id" FROM "${t}" x`);
    expect(sql).toContain(
      `UPDATE "${t}" x SET "branch_id" = (SELECT "id" FROM pq)`,
    );
  });

  it('up() xóa mềm GR, GN (is_deleted, is_active)', async () => {
    const { runner, query } = makeRunner();
    await new KgaraBranchToPhoQuang20261126110000().up(runner);
    expect(sqlOf(query)).toContain(
      `UPDATE "branches_management" b SET "is_deleted" = true, "is_active" = false`,
    );
  });

  it('down() hoàn lại từ bảng sao lưu rồi xóa bảng', async () => {
    const { runner, query } = makeRunner([{ ok: true }]);
    await new KgaraBranchToPhoQuang20261126110000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`"is_deleted" = k."old_is_deleted"`);
    expect(sql).toContain(
      `UPDATE "cases_garage" x SET "branch_id" = k."old_branch_id"`,
    );
    expect(sql).toContain('DROP TABLE "_mig_kgara_branch_pq_backup"');
  });

  it('down() bỏ qua khi không có bảng sao lưu', async () => {
    const { runner, query } = makeRunner([{ ok: false }]);
    await new KgaraBranchToPhoQuang20261126110000().down(runner);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
