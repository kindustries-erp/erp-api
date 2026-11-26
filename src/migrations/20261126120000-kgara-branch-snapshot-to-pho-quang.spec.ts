import { QueryRunner } from 'typeorm';
import { KgaraBranchSnapshotToPhoQuang20261126120000 } from './20261126120000-kgara-branch-snapshot-to-pho-quang';

describe('KgaraBranchSnapshotToPhoQuang20261126120000', () => {
  const makeRunner = (rows: unknown[] = []) => {
    const query = jest.fn(() => Promise.resolve(rows));
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');

  it('up() sao lưu rồi đổi snapshot branchId GR/GN (kể cả đã xóa mềm) sang PQ', async () => {
    const { runner, query } = makeRunner();
    await new KgaraBranchSnapshotToPhoQuang20261126120000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`WHERE "code" IN ('GR', 'GN'))`);
    expect(sql).toContain(`SELECT c."id", c."source_snapshot"->>'branchId'`);
    expect(sql).toContain(
      `jsonb_build_object('branchId', (SELECT "id" FROM pq))`,
    );
    expect(sql).toContain('EXISTS (SELECT 1 FROM pq)');
  });

  it('down() hoàn lại từ bảng sao lưu rồi xóa bảng', async () => {
    const { runner, query } = makeRunner([{ ok: true }]);
    await new KgaraBranchSnapshotToPhoQuang20261126120000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`jsonb_build_object('branchId', k."old_branch_id")`);
    expect(sql).toContain('DROP TABLE "_mig_kgara_branch_snapshot_backup"');
  });

  it('down() bỏ qua khi không có bảng sao lưu', async () => {
    const { runner, query } = makeRunner([{ ok: false }]);
    await new KgaraBranchSnapshotToPhoQuang20261126120000().down(runner);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
