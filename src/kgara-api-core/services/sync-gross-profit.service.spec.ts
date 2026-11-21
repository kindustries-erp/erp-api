import { SyncGrossProfitService } from './sync-gross-profit.service';

describe('SyncGrossProfitService', () => {
  const makeRepo = (existingJournal: unknown) => {
    const getRawOne = jest.fn(async () =>
      existingJournal === undefined ? null : { journal: existingJournal },
    );
    const qb: any = {};
    qb.select = jest.fn(() => qb);
    qb.where = jest.fn(() => qb);
    qb.getRawOne = getRawOne;
    return {
      createQueryBuilder: jest.fn(() => qb),
      upsert: jest.fn(async () => undefined),
      _qb: qb,
    };
  };

  const build = (opts: {
    existingJournal?: unknown;
    groups?: any[];
    journalFails?: boolean;
  }) => {
    const repo = makeRepo(opts.existingJournal);
    const client: any = {
      getGrossProfitDetail: jest.fn(async () => ({
        results: { Groups: opts.groups ?? [] },
      })),
    };
    const journal: any = {
      syncJournalForRange: opts.journalFails
        ? jest.fn(async () => {
            throw new Error('journal down');
          })
        : jest.fn(async () => ({
            vuViecs: 0,
            updated: 0,
            noItems: 0,
            notStored: 0,
          })),
    };
    const finalizer: any = {
      finalizePeriod: jest.fn(async () => ({
        journalCases: 3,
        enrichedCases: 2,
        failed: 1,
      })),
    };
    const service = new SyncGrossProfitService(
      repo as any,
      client,
      journal,
      finalizer,
    );
    return { service, repo, client, journal, finalizer };
  };

  const item = { VuViecID: 'V1', VuViecCode: 'GR-1', DoanhThu: 10, ChiPhi: 4 };
  const range = { from: '2026-09-01', to: '2026-09-30' };

  it('giữ journal_items đã lưu khi upsert lãi gộp', async () => {
    const journal = [{ TaiKhoanNoCode: '1541', GiaTriTien: 100 }];
    const { service, repo } = build({ existingJournal: journal });

    await service.persistItem(item, 'BR', range);

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        hdPhieuDichVuId: 'V1',
        rawData: { ...item, journal_items: journal },
      }),
      ['hdPhieuDichVuId'],
    );
  });

  it('không có journal thì rawData là item gốc', async () => {
    const { service, repo } = build({ existingJournal: undefined });

    await service.persistItem(item, 'BR', range);

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ rawData: item }),
      ['hdPhieuDichVuId'],
    );
  });

  it('sync tháng: upsert từng vụ việc rồi gọi sync journal cho đúng kỳ', async () => {
    const { service, repo, journal } = build({
      groups: [{ Items: [item, { VuViecID: 'V2', VuViecCode: 'GR-2' }] }],
    });

    await service.syncGrossProfitForBranch('BR', '2026-09-01', '2026-09-30');

    expect(repo.upsert).toHaveBeenCalledTimes(2);
    expect(journal.syncJournalForRange).toHaveBeenCalledWith(
      'BR',
      '2026-09-01',
      '2026-09-30',
      expect.anything(),
    );
  });

  it('lỗi sync journal không làm dừng sync lãi gộp', async () => {
    const { service, repo } = build({
      groups: [{ Items: [item] }],
      journalFails: true,
    });

    await expect(
      service.syncGrossProfitForBranch('BR', '2026-09-01', '2026-09-30'),
    ).resolves.toEqual({
      journalCases: 0,
      enrichedCases: 0,
      projected: 0,
      failed: 0,
    });
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  it('làm giàu giá vốn cho kỳ sau khi lưu journal và trả thống kê (AC-1, 2.4.1)', async () => {
    const { service, finalizer } = build({ groups: [{ Items: [item] }] });

    const stats = await service.syncGrossProfitForBranch(
      'BR',
      '2026-09-01',
      '2026-09-30',
    );

    expect(finalizer.finalizePeriod).toHaveBeenCalledWith(
      'BR',
      '2026-09-01',
      '2026-09-30',
    );
    expect(stats).toEqual({
      journalCases: 3,
      enrichedCases: 2,
      projected: 2,
      failed: 1,
    });
  });
});
