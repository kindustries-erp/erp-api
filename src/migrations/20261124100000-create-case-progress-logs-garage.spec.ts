import { QueryRunner } from 'typeorm';
import { CreateCaseProgressLogsGarage20261124100000 } from './20261124100000-create-case-progress-logs-garage';

describe('CreateCaseProgressLogsGarage20261124100000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() tạo bảng có FK cascade tới cases_garage và các cột nhật ký', async () => {
    const { runner, query } = makeRunner();
    await new CreateCaseProgressLogsGarage20261124100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS "case_progress_logs_garage"',
    );
    expect(sql).toContain('REFERENCES "cases_garage" ("id") ON DELETE CASCADE');
    for (const col of [
      '"kind" varchar(10) NOT NULL',
      '"stage" varchar(30)',
      '"worker_id" uuid',
      '"worker_name" varchar(255)',
      '"started_at" timestamptz NOT NULL',
      '"ended_at" timestamptz',
      '"is_deleted" boolean NOT NULL DEFAULT false',
      '"extra_data" jsonb NOT NULL',
    ]) {
      expect(sql).toContain(col);
    }
    expect(sql).not.toMatch(/REFERENCES "employees_management"/);
  });

  it('up() ràng buộc kind, stage bắt buộc với STAGE và ended_at >= started_at', async () => {
    const { runner, query } = makeRunner();
    await new CreateCaseProgressLogsGarage20261124100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`CHECK ("kind" IN ('STAGE', 'NOTE'))`);
    expect(sql).toContain(`CHECK ("kind" <> 'STAGE' OR "stage" IS NOT NULL)`);
    expect(sql).toContain(
      'CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")',
    );
  });

  it('up() có index (case_id, started_at) và unique một công đoạn mở mỗi xe', async () => {
    const { runner, query } = makeRunner();
    await new CreateCaseProgressLogsGarage20261124100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'ON "case_progress_logs_garage" ("case_id", "started_at")',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_case_progress_logs_garage_open_stage"',
    );
    expect(sql).toContain(
      `WHERE "kind" = 'STAGE' AND "ended_at" IS NULL AND "is_deleted" = false`,
    );
  });

  it('down() drop bảng', async () => {
    const { runner, query } = makeRunner();
    await new CreateCaseProgressLogsGarage20261124100000().down(runner);
    expect(sqlOf(query)).toContain(
      'DROP TABLE IF EXISTS "case_progress_logs_garage"',
    );
  });
});
