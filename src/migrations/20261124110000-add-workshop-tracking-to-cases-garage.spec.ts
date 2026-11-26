import { QueryRunner } from 'typeorm';
import { AddWorkshopTrackingToCasesGarage20261124110000 } from './20261124110000-add-workshop-tracking-to-cases-garage';

describe('AddWorkshopTrackingToCasesGarage20261124110000', () => {
  const makeRunner = () => {
    const query = jest.fn().mockResolvedValue(undefined);
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c) => c[0] as string).join('\n');

  it('up() thêm hai cột nullable, không backfill', async () => {
    const { runner, query } = makeRunner();
    await new AddWorkshopTrackingToCasesGarage20261124110000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS "workshop_tracked_at" timestamptz',
    );
    expect(sql).toContain(
      'ADD COLUMN IF NOT EXISTS "workshop_tracked_by" uuid',
    );
    const alter = query.mock.calls[0][0] as string;
    expect(alter).not.toMatch(/NOT NULL/);
    expect(sql).not.toMatch(/UPDATE\s+"cases_garage"/);
    expect(sql).not.toMatch(/REFERENCES/);
  });

  it('up() tạo index phần theo chi nhánh cho xe đang trên bảng', async () => {
    const { runner, query } = makeRunner();
    await new AddWorkshopTrackingToCasesGarage20261124110000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "IDX_cases_garage_workshop_tracked"',
    );
    expect(sql).toContain('("branch_external_id", "workshop_tracked_at")');
    expect(sql).toContain('WHERE "workshop_tracked_at" IS NOT NULL');
  });

  it('down() drop index và hai cột', async () => {
    const { runner, query } = makeRunner();
    await new AddWorkshopTrackingToCasesGarage20261124110000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'DROP INDEX IF EXISTS "IDX_cases_garage_workshop_tracked"',
    );
    expect(sql).toContain('DROP COLUMN IF EXISTS "workshop_tracked_by"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "workshop_tracked_at"');
  });
});
