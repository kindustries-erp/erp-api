import { QueryRunner } from 'typeorm';
import { CreateDocumentSequences20261010150000 } from './20261010150000-CreateDocumentSequences';

describe('CreateDocumentSequences20261010150000', () => {
  const migration = new CreateDocumentSequences20261010150000();

  const makeRunner = (opts: {
    tableExists: boolean;
    indexdef?: string | null;
    comment?: string | null;
  }) => {
    const sql: string[] = [];
    const runner = {
      hasTable: jest.fn().mockResolvedValue(opts.tableExists),
      query: jest.fn().mockImplementation((q: string) => {
        sql.push(q);
        if (/FROM pg_indexes/.test(q)) {
          return Promise.resolve(
            opts.indexdef === null
              ? []
              : [
                  {
                    indexdef:
                      opts.indexdef ??
                      "CREATE UNIQUE INDEX uq ON public.erp_document_sequences USING btree (prefix, period, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))",
                  },
                ],
          );
        }
        if (/obj_description/.test(q)) {
          return Promise.resolve([{ comment: opts.comment ?? null }]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as QueryRunner;
    return { runner, sql };
  };

  it('creates the table, expression index and seeds counters when the table is missing', async () => {
    const { runner, sql } = makeRunner({ tableExists: false });
    await migration.up(runner);
    const all = sql.join('\n');
    expect(all).toMatch(/CREATE TABLE erp_document_sequences/);
    expect(all).toMatch(/COMMENT ON TABLE erp_document_sequences/);
    expect(all).toMatch(/COALESCE\(branch_id/);
    expect(all).toMatch(/INSERT INTO erp_document_sequences/);
    expect(all).toMatch(/GREATEST/);
    expect(all).toMatch(/\[0-9\]\{4\}/);
  });

  it('is a safe no-op for an existing table with the right index (no create, no seed)', async () => {
    const { runner, sql } = makeRunner({ tableExists: true });
    await migration.up(runner);
    const all = sql.join('\n');
    expect(all).not.toMatch(/CREATE TABLE/);
    expect(all).not.toMatch(/INSERT INTO erp_document_sequences/);
    expect(all).not.toMatch(/DROP/);
  });

  it('fails loudly (never drops) when an index of the same name has a different definition', async () => {
    const { runner, sql } = makeRunner({
      tableExists: true,
      indexdef:
        'CREATE UNIQUE INDEX uq ON public.erp_document_sequences USING btree (prefix, period, branch_id)',
    });
    await expect(migration.up(runner)).rejects.toThrow(/COALESCE\(branch_id/);
    expect(sql.join('\n')).not.toMatch(/DROP/);
  });

  it('down() drops only a table created by this migration', async () => {
    const owned = makeRunner({
      tableExists: true,
      comment: 'created-by-migration: CreateDocumentSequences20261010150000',
    });
    await migration.down(owned.runner);
    expect(owned.sql.join('\n')).toMatch(/DROP TABLE IF EXISTS/);

    const foreign = makeRunner({ tableExists: true, comment: null });
    await migration.down(foreign.runner);
    expect(foreign.sql.join('\n')).not.toMatch(/DROP TABLE/);
  });
});
