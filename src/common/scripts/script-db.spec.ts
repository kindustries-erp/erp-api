import { DataSource } from 'typeorm';
import { countRows, diffCounts } from './dry-run-probe.helper';
import { connectPg, createScriptDataSource, withPgSession } from './script-db';
import type { ScriptEnv, WriteGuard } from './load-script-env';

const env = {
  databaseUrl: 'postgresql://u:p@h:5432/erp_local',
  ssl: false,
} as unknown as ScriptEnv;
const apply: WriteGuard = { apply: true, allowed: true, message: '' };
const dry: WriteGuard = { apply: false, allowed: false, message: '' };

const fakeClient = () => {
  const calls: string[] = [];
  const client: any = {
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockImplementation((q: string) => {
      calls.push(q);
      return Promise.resolve({ rows: [] });
    }),
  };
  return { client, calls };
};

describe('connectPg / withPgSession', () => {
  it('wraps everything in a transaction and ROLLS BACK on dry-run', async () => {
    const { client, calls } = fakeClient();
    const s = await connectPg(env, dry, { clientFactory: () => client });
    await s.client.query('UPDATE x SET a=1');
    expect(await s.finish()).toBe('ROLLED_BACK');
    expect(calls).toEqual(['BEGIN', 'UPDATE x SET a=1', 'ROLLBACK']);
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it('COMMITs when the guard allows the write', async () => {
    const { client, calls } = fakeClient();
    const s = await connectPg(env, apply, { clientFactory: () => client });
    expect(await s.finish()).toBe('COMMITTED');
    expect(calls).toEqual(['BEGIN', 'COMMIT']);
  });

  it('finish() is idempotent and abort() always rolls back', async () => {
    const a = fakeClient();
    const s1 = await connectPg(env, apply, { clientFactory: () => a.client });
    await s1.finish();
    await s1.finish();
    expect(a.calls.filter((c) => c === 'COMMIT')).toHaveLength(1);

    const b = fakeClient();
    const s2 = await connectPg(env, apply, { clientFactory: () => b.client });
    await s2.abort();
    expect(b.calls).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('passes the SSL option and connection string to the client factory', async () => {
    const { client } = fakeClient();
    const factory = jest.fn().mockReturnValue(client);
    await connectPg(env, dry, { clientFactory: factory });
    expect(factory).toHaveBeenCalledWith({
      connectionString: env.databaseUrl,
      ssl: false,
    });
  });

  it('closes the connection if BEGIN fails', async () => {
    const { client } = fakeClient();
    client.query.mockRejectedValueOnce(new Error('boom'));
    await expect(
      connectPg(env, dry, { clientFactory: () => client }),
    ).rejects.toThrow('boom');
    expect(client.end).toHaveBeenCalled();
  });

  it('withPgSession rolls back and rethrows when the callback fails', async () => {
    const { client, calls } = fakeClient();
    await expect(
      withPgSession(
        env,
        apply,
        async () => {
          throw new Error('script failed');
        },
        { clientFactory: () => client },
      ),
    ).rejects.toThrow('script failed');
    expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('withPgSession returns the result and the outcome', async () => {
    const { client } = fakeClient();
    const r = await withPgSession(env, dry, async () => 42, {
      clientFactory: () => client,
    });
    expect(r).toEqual({ result: 42, outcome: 'ROLLED_BACK' });
  });
});

describe('ScriptDataSource', () => {
  const fakeRunner = () => {
    const calls: string[] = [];
    const runner: any = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockImplementation(() => {
        calls.push('START');
        return Promise.resolve();
      }),
      commitTransaction: jest.fn().mockImplementation(() => {
        calls.push('COMMIT');
        return Promise.resolve();
      }),
      rollbackTransaction: jest.fn().mockImplementation(() => {
        calls.push('ROLLBACK');
        return Promise.resolve();
      }),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((q: string) => {
        calls.push(q);
        return Promise.resolve([{ ok: true }]);
      }),
    };
    return { runner, calls };
  };

  const make = (guard: WriteGuard) => {
    const { runner, calls } = fakeRunner();
    const ds = createScriptDataSource(env, guard);
    jest.spyOn(ds, 'createQueryRunner').mockReturnValue(runner);
    // không kết nối thật
    Object.defineProperty(ds, 'isInitialized', { value: true });
    return { ds, runner, calls };
  };

  afterEach(() => jest.restoreAllMocks());

  it('routes ds.query through the shared transaction and rolls back on dry-run', async () => {
    const { ds, runner, calls } = make(dry);
    await ds.begin();
    await ds.query('UPDATE a SET b=1');
    await ds.query('DELETE FROM c');
    expect(await ds.finish()).toBe('ROLLED_BACK');
    expect(calls).toEqual([
      'START',
      'UPDATE a SET b=1',
      'DELETE FROM c',
      'ROLLBACK',
    ]);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('commits when the guard allows', async () => {
    const { ds, calls } = make(apply);
    await ds.begin();
    await ds.query('INSERT INTO t VALUES (1)');
    expect(await ds.finish()).toBe('COMMITTED');
    expect(calls).toEqual(['START', 'INSERT INTO t VALUES (1)', 'COMMIT']);
  });

  it('finish() is idempotent', async () => {
    const { ds, calls } = make(apply);
    await ds.begin();
    await ds.finish();
    await ds.finish();
    expect(calls.filter((c) => c === 'COMMIT')).toHaveLength(1);
  });

  it('destroy() rolls back an unfinished transaction instead of committing', async () => {
    const { ds, calls } = make(apply);
    jest.spyOn(DataSource.prototype, 'destroy').mockResolvedValue(undefined);
    await ds.begin();
    await ds.query('UPDATE a SET b=1');
    await ds.destroy();
    expect(calls).toEqual(['START', 'UPDATE a SET b=1', 'ROLLBACK']);
  });

  it('builds the postgres options from the script env', () => {
    const ds = createScriptDataSource(env, dry);
    expect(ds.options).toMatchObject({
      type: 'postgres',
      url: env.databaseUrl,
      ssl: false,
    });
  });
});

describe('dry-run probe', () => {
  it('counts rows and validates table names', async () => {
    const db = { query: jest.fn().mockResolvedValue([{ n: 7 }]) };
    expect(await countRows(db, ['erp_invoices'])).toEqual({ erp_invoices: 7 });
    await expect(countRows(db, ['x; DROP TABLE y'])).rejects.toThrow(
      /Tên bảng không hợp lệ/,
    );
  });

  it('reads pg-style results ({ rows })', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ n: 3 }] }) };
    expect(await countRows(db, ['t'])).toEqual({ t: 3 });
  });

  it('diffCounts reports only the changed tables', () => {
    expect(diffCounts({ a: 1, b: 2 }, { a: 1, b: 5, c: 1 })).toEqual({
      b: { before: 2, after: 5, delta: 3 },
      c: { before: 0, after: 1, delta: 1 },
    });
  });
});
