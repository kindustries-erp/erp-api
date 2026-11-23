import { QueryRunner } from 'typeorm';
import { AddLinkOverrideProcurementRequestsGarage20261123100000 } from './20261123100000-add-link-override-procurement-requests-garage';

describe('AddLinkOverrideProcurementRequestsGarage20261123100000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() thêm 2 cột jsonb mặc định {} và backfill snapshot từ branch_name', async () => {
    const { runner, query } = makeRunner();
    await new AddLinkOverrideProcurementRequestsGarage20261123100000().up(
      runner,
    );
    const sql = sqlOf(query);
    expect(sql).toContain('"source_snapshot" jsonb NOT NULL DEFAULT');
    expect(sql).toContain('"overrides" jsonb NOT NULL DEFAULT');
    expect(sql).toContain('jsonb_build_object(\'branchName\', "branch_name")');
    expect(sql).toContain('"branch_name" IS NOT NULL');
    expect(sql).not.toContain('"overrides" =');
  });

  it('down() bỏ 2 cột', async () => {
    const { runner, query } = makeRunner();
    await new AddLinkOverrideProcurementRequestsGarage20261123100000().down(
      runner,
    );
    const sql = sqlOf(query);
    expect(sql).toContain('DROP COLUMN IF EXISTS "overrides"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "source_snapshot"');
  });
});
