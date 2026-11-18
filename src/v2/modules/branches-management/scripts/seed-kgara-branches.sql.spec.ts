import { runSeed, SeedClient } from './seed-kgara-branches.sql';

const cand = (code: string, key: string) => ({
  external_id: '0b4d6d3a-55df-492b-abaf-377d84b61d05',
  account_key: key,
  code,
  name: `Name ${code}`,
  cases: 5,
});

describe('runSeed', () => {
  const make = (opts: {
    candidates: ReturnType<typeof cand>[];
    existingCodes?: string[];
    existingLinks?: boolean;
  }) => {
    const query = jest.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM kgara_branches'))
        return Promise.resolve({ rows: opts.candidates });
      if (sql.includes('FROM branches_management WHERE code'))
        return Promise.resolve({
          rows: opts.existingCodes?.includes(params?.[0] as string)
            ? [{ id: `id-${String(params?.[0])}` }]
            : [],
        });
      if (sql.includes('INSERT INTO branches_management '))
        return Promise.resolve({
          rows: [{ id: `new-${String(params?.[0])}` }],
        });
      if (sql.includes('external_links'))
        return Promise.resolve({
          rows: opts.existingLinks ? [] : [{ id: 'link' }],
        });
      return Promise.reject(new Error(`unexpected sql: ${sql}`));
    });
    return { client: { query } as unknown as SeedClient, query };
  };

  it('tạo chi nhánh và liên kết cho GR/MAIN và GN/OJ', async () => {
    const { client, query } = make({
      candidates: [cand('GN', 'OJ'), cand('GR', 'MAIN')],
    });
    const rows = await runSeed(client);
    expect(rows.map((r) => [r.code, r.accountKey, r.branch, r.link])).toEqual([
      ['GN', 'OJ', 'CREATED', 'CREATED'],
      ['GR', 'MAIN', 'CREATED', 'CREATED'],
    ]);
    const linkCall = query.mock.calls.find((c) =>
      (c[0] as string).includes('external_links'),
    );
    expect(linkCall?.[1]).toEqual([
      'new-GN',
      'KGARA',
      expect.any(String),
      'OJ',
    ]);
  });

  it('chạy lại không đổi: dùng chi nhánh có sẵn, liên kết trùng bị bỏ qua', async () => {
    const { client, query } = make({
      candidates: [cand('GR', 'MAIN')],
      existingCodes: ['GR'],
      existingLinks: true,
    });
    const rows = await runSeed(client);
    expect(rows[0]).toMatchObject({ branch: 'EXISTING', link: 'EXISTING' });
    expect(
      query.mock.calls.some((c) =>
        (c[0] as string).includes('INSERT INTO branches_management '),
      ),
    ).toBe(false);
  });

  it('không có ứng viên thì không ghi gì', async () => {
    const { client, query } = make({ candidates: [] });
    expect(await runSeed(client)).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
