import { findSyncableBranches } from './syncable-branches.helper';

const branch = (externalId: string, accountKey: string, name: string) => ({
  externalId,
  accountKey,
  name,
});

describe('findSyncableBranches', () => {
  const rows = [
    branch('0b4d', 'MAIN', 'GREENWAY AUTO'),
    branch('0b4d', 'OJ', 'GREENWAY AUTO - CN2'),
    branch('369c', 'MAIN', 'Root'),
    branch('369c', 'OJ', 'Root'),
    branch('35d8', 'MAIN', 'HỆ THỐNG GREEN WAY'),
  ];
  const repoWith = (links: unknown[]) =>
    ({
      find: jest.fn().mockResolvedValue(rows),
      manager: { query: jest.fn().mockResolvedValue(links) },
    }) as any;

  it('chỉ trả chi nhánh khớp liên kết ERP theo external_id + account_key', async () => {
    const repo = repoWith([
      { external_id: '0b4d', account_key: 'MAIN' },
      { external_id: '0b4d', account_key: 'OJ' },
    ]);

    const result = await findSyncableBranches(repo);

    expect(result.linked).toBe(true);
    expect(
      result.branches.map((b) => `${b.externalId}/${b.accountKey}`),
    ).toEqual(['0b4d/MAIN', '0b4d/OJ']);
    expect(repo.manager.query.mock.calls[0][0]).toContain("source = 'KGARA'");
  });

  it('liên kết không có account_key thì khớp mọi tài khoản của external id', async () => {
    const result = await findSyncableBranches(
      repoWith([{ external_id: '369c', account_key: null }]),
    );

    expect(result.branches.map((b) => b.accountKey)).toEqual(['MAIN', 'OJ']);
  });

  it('lọc theo tài khoản đã cấu hình', async () => {
    const result = await findSyncableBranches(
      repoWith([
        { external_id: '0b4d', account_key: 'MAIN' },
        { external_id: '0b4d', account_key: 'OJ' },
      ]),
      ['MAIN'],
    );

    expect(result.branches).toEqual([branch('0b4d', 'MAIN', 'GREENWAY AUTO')]);
  });

  it('chưa có liên kết nào khớp: trả tất cả và báo linked=false', async () => {
    const result = await findSyncableBranches(repoWith([]), ['MAIN']);

    expect(result.linked).toBe(false);
    expect(result.branches).toHaveLength(3);
  });
});
