import { QueryRunner } from 'typeorm';
import { RestoreV1AuditLogs20261115160000 } from './20261115160000-restore-v1-audit-logs';

function fakeRunner() {
  const sql: string[] = [];
  const runner = {
    query: jest.fn(async (statement: string) => {
      sql.push(statement.replace(/\s+/g, ' ').trim());
      return [];
    }),
  } as unknown as QueryRunner;
  return { runner, sql };
}

describe('RestoreV1AuditLogs20261115160000', () => {
  const migration = new RestoreV1AuditLogs20261115160000();

  it('up chỉ INSERT vào erp_audit_logs, idempotent theo id', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toMatch(/^INSERT INTO "erp_audit_logs"/);
    expect(sql[0]).toContain('FROM "audit_logs"');
    expect(sql[0]).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it('up loại dòng của V2 (route /api/v2 và entity users_management)', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    expect(sql[0]).toContain(`NOT LIKE '%/api/v2/%'`);
    expect(sql[0]).toContain(`<> 'users_management'`);
  });

  it('up không sửa hay xóa audit_logs', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    expect(
      sql.some((s) => /(UPDATE|DELETE FROM|DROP|ALTER) .*"audit_logs"/.test(s)),
    ).toBe(false);
  });

  it('down không chạy câu lệnh nào', async () => {
    await expect(migration.down()).resolves.toBeUndefined();
  });
});
