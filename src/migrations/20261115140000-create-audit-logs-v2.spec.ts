import { QueryRunner } from 'typeorm';
import { CreateAuditLogsV220261115140000 } from './20261115140000-create-audit-logs-v2';

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

describe('CreateAuditLogsV220261115140000', () => {
  const migration = new CreateAuditLogsV220261115140000();

  it('up tạo bảng audit_logs idempotent với 4 index', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    const all = sql.join('\n');
    expect(all).toContain('CREATE TABLE IF NOT EXISTS "audit_logs"');
    expect(all).toContain('"created_at" timestamp NOT NULL DEFAULT now()');
    expect(all).toContain(
      'IDX_audit_logs_entity_created" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC)',
    );
    expect(all).toContain('IDX_audit_logs_created_at');
    expect(all).toContain('IDX_audit_logs_actor_created');
    expect(all).toContain(
      'IDX_audit_logs_module_action" ON "audit_logs" ("module", "action_type")',
    );
    expect(
      sql.filter((s) => s.startsWith('CREATE INDEX IF NOT EXISTS')),
    ).toHaveLength(4);
  });

  it('up backfill giữ id, an toàn khi chạy lại và không sửa bảng cũ', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    const backfill = sql.find((s) => s.startsWith('INSERT INTO "audit_logs"'));
    expect(backfill).toBeDefined();
    expect(backfill).toContain('FROM "erp_audit_logs"');
    expect(backfill).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(
      sql.some((s) =>
        /(UPDATE|DELETE FROM|DROP|ALTER) .*"erp_audit_logs"/.test(s),
      ),
    ).toBe(false);
  });

  it('up tạo bảng và index trước khi backfill', async () => {
    const { runner, sql } = fakeRunner();
    await migration.up(runner);
    const idxCreate = sql.findIndex((s) => s.startsWith('CREATE TABLE'));
    const idxBackfill = sql.findIndex((s) => s.startsWith('INSERT INTO'));
    expect(idxCreate).toBe(0);
    expect(idxBackfill).toBeGreaterThan(idxCreate);
  });

  it('down chỉ xóa audit_logs', async () => {
    const { runner, sql } = fakeRunner();
    await migration.down(runner);
    expect(sql).toEqual(['DROP TABLE IF EXISTS "audit_logs"']);
  });
});
