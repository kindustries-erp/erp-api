import { SyncGrossProfitJournalService } from './sync-gross-profit-journal.service';

describe('SyncGrossProfitJournalService', () => {
  const makeQb = (affected: number) => {
    const qb: any = {};
    qb.update = jest.fn(() => qb);
    qb.set = jest.fn(() => qb);
    qb.setParameters = jest.fn(() => qb);
    qb.where = jest.fn(() => qb);
    qb.execute = jest.fn(async () => ({ affected }));
    return qb;
  };

  const build = (journalResponse: any, affectedPerCall: number[] = []) => {
    const qbs: any[] = [];
    let i = 0;
    const repo: any = {
      createQueryBuilder: jest.fn(() => {
        const qb = makeQb(affectedPerCall[i++] ?? 1);
        qbs.push(qb);
        return qb;
      }),
    };
    const client: any = {
      getGrossProfitJournal: jest.fn(async () => journalResponse),
    };
    const service = new SyncGrossProfitJournalService(repo, client);
    return { service, client, qbs };
  };

  it('ghép theo VuViecCode, merge journal_items và không gọi vuViecID', async () => {
    const items = [{ TaiKhoanNoCode: '1541', GiaTriTien: 100 }];
    const { service, client, qbs } = build(
      { results: { VuViecs: [{ VuViecCode: 'GR-1', Items: items }] } },
      [1],
    );

    const res = await service.syncJournalForRange(
      'BR',
      '2026-09-01',
      '2026-09-30',
    );

    expect(client.getGrossProfitJournal).toHaveBeenCalledWith(
      'BR',
      '2026-09-01',
      '2026-09-30',
      undefined,
      expect.anything(),
    );
    expect(qbs[0].where).toHaveBeenCalledWith(
      'branch_external_id = :branchId AND vu_viec_code = :code',
      { branchId: 'BR', code: 'GR-1' },
    );
    expect(qbs[0].setParameters).toHaveBeenCalledWith({
      journalItems: JSON.stringify(items),
    });
    expect(res).toEqual({ vuViecs: 1, updated: 1, noItems: 0, notStored: 0 });
  });

  it('bỏ qua vụ việc không có Items và đếm riêng', async () => {
    const { service, qbs } = build({
      results: {
        VuViecs: [{ VuViecCode: 'GR-2', Items: [] }, { VuViecCode: 'GR-3' }],
      },
    });

    const res = await service.syncJournalForRange(
      'BR',
      '2026-09-01',
      '2026-09-30',
    );

    expect(qbs).toHaveLength(0);
    expect(res).toEqual({ vuViecs: 2, updated: 0, noItems: 2, notStored: 0 });
  });

  it('đếm notStored khi chưa có dòng lãi gộp tương ứng', async () => {
    const { service } = build(
      {
        results: {
          VuViecs: [{ VuViecCode: 'GR-4', Items: [{ GiaTriTien: 1 }] }],
        },
      },
      [0],
    );

    const res = await service.syncJournalForRange(
      'BR',
      '2026-09-01',
      '2026-09-30',
    );

    expect(res).toEqual({ vuViecs: 1, updated: 0, noItems: 0, notStored: 1 });
  });

  it('coi 404 từ KGara là journal rỗng', async () => {
    const { service, client } = build(null);
    client.getGrossProfitJournal.mockRejectedValueOnce(
      new Error('Kgara API Error: 404 Không có dữ liệu'),
    );

    const res = await service.syncJournalForRange(
      'BR',
      '2026-09-01',
      '2026-09-30',
    );

    expect(res).toEqual({ vuViecs: 0, updated: 0, noItems: 0, notStored: 0 });
  });

  it('ném lại lỗi khác 404', async () => {
    const { service, client } = build(null);
    client.getGrossProfitJournal.mockRejectedValueOnce(
      new Error('Kgara API Error: 500 boom'),
    );

    await expect(
      service.syncJournalForRange('BR', '2026-09-01', '2026-09-30'),
    ).rejects.toThrow('500 boom');
  });

  it('ném lỗi khi KGara trả status lỗi trong body (không coi là rỗng)', async () => {
    const { service, client } = build(null);
    client.getGrossProfitJournal.mockResolvedValueOnce({
      status: 500,
      message: 'Thông tin đăng nhập không hợp lệ!',
      results: null,
    });

    await expect(
      service.syncJournalForRange('BR', '2026-09-01', '2026-09-30'),
    ).rejects.toThrow('500');
  });
});
