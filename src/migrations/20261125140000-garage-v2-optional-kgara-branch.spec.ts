import { QueryRunner } from 'typeorm';
import { GarageV2OptionalKgaraBranch20261125140000 } from './20261125140000-garage-v2-optional-kgara-branch';

const TABLES = [
  'cases_garage',
  'case_progress_logs_garage',
  'debts_garage',
  'debt_allocations_garage',
  'cashflow_vouchers_garage',
];

describe('GarageV2OptionalKgaraBranch20261125140000', () => {
  const makeRunner = (nullCount = 0, dupes: unknown[] = []) => {
    const query = jest.fn((sql: string) => {
      if (sql.startsWith('SELECT count'))
        return Promise.resolve([{ n: nullCount }]);
      if (sql.includes('HAVING count(*) > 1')) return Promise.resolve(dupes);
      return Promise.resolve([]);
    });
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() bỏ NOT NULL branch_external_id trên cả 5 bảng', async () => {
    const { runner, query } = makeRunner();
    await new GarageV2OptionalKgaraBranch20261125140000().up(runner);
    const sql = sqlOf(query);
    for (const t of TABLES) {
      expect(sql).toContain(
        `ALTER TABLE "${t}" ALTER COLUMN "branch_external_id" DROP NOT NULL`,
      );
    }
  });

  it('up() đổi unique mã phiếu sang (account_key, case_code) và index board theo branch_id', async () => {
    const { runner, query } = makeRunner();
    await new GarageV2OptionalKgaraBranch20261125140000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('ON "cases_garage" ("account_key", "case_code")');
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "IDX_cases_garage_workshop_tracked"',
    );
    expect(sql).toContain('("branch_id", "workshop_tracked_at")');
  });

  it('up() dừng với thông báo rõ khi còn mã phiếu trùng (account_key, case_code)', async () => {
    const { runner, query } = makeRunner(0, [
      { account_key: 'MAIN', case_code: 'SC-01', n: 2 },
    ]);
    await expect(
      new GarageV2OptionalKgaraBranch20261125140000().up(runner),
    ).rejects.toThrow(/MAIN\/SC-01 \(2\)/);
    expect(sqlOf(query)).not.toContain(
      'ON "cases_garage" ("account_key", "case_code")',
    );
  });

  it('up() backfill branch_id chỉ cho dòng NULL, không ghi đè', async () => {
    const { runner, query } = makeRunner();
    await new GarageV2OptionalKgaraBranch20261125140000().up(runner);
    const updates = query.mock.calls
      .map((c) => c[0] as string)
      .filter((s) => s.includes('UPDATE'));
    expect(updates).toHaveLength(3);
    for (const u of updates) expect(u).toMatch(/"branch_id" IS NULL/);
    expect(updates[2]).toContain('a."debt_id" = d."id"');
  });

  it('down() khôi phục index cũ và NOT NULL khi không còn dòng NULL', async () => {
    const { runner, query } = makeRunner(0);
    await new GarageV2OptionalKgaraBranch20261125140000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain('("branch_external_id", "account_key", "case_code")');
    expect(sql).toContain('("branch_external_id", "workshop_tracked_at")');
    for (const t of TABLES) {
      expect(sql).toContain(
        `ALTER TABLE "${t}" ALTER COLUMN "branch_external_id" SET NOT NULL`,
      );
    }
  });

  it('down() báo lỗi khi còn dòng branch_external_id NULL', async () => {
    const { runner } = makeRunner(3);
    await expect(
      new GarageV2OptionalKgaraBranch20261125140000().down(runner),
    ).rejects.toThrow(/còn 3 dòng NULL/);
  });
});
