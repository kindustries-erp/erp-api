import { KgaraCaseFinalizeService } from './kgara-case-finalize.service';

describe('KgaraCaseFinalizeService', () => {
  const build = (opts: { ids?: string[]; cases?: any[] }) => {
    const qb: any = {};
    qb.select = jest.fn(() => qb);
    qb.where = jest.fn(() => qb);
    qb.andWhere = jest.fn(() => qb);
    qb.getRawMany = jest.fn(async () =>
      (opts.ids ?? []).map((code) => ({ code })),
    );
    const gpRepo: any = { createQueryBuilder: jest.fn(() => qb) };
    const caseRepo: any = { find: jest.fn(async () => opts.cases ?? []) };
    const lookup: any = { enrichCostForCase: jest.fn(async () => true) };
    const service = new KgaraCaseFinalizeService(gpRepo, caseRepo, lookup);
    return { service, gpRepo, caseRepo, lookup, qb };
  };

  it('finalizeCase chỉ dùng journal đã lưu và không chiếu V2 mặc định', async () => {
    const { service, lookup } = build({});
    const c: any = { id: 'c1' };

    const res = await service.finalizeCase(c);

    expect(res).toBe(true);
    expect(lookup.enrichCostForCase).toHaveBeenCalledWith(c, {
      skipRemote: true,
      notifyProjector: false,
    });
  });

  it('finalizePeriod làm giàu từng phiếu có journal trong kỳ và đếm kết quả (AC-1)', async () => {
    const { service, lookup, qb } = build({
      ids: ['a', 'b', 'c'],
      cases: [{ id: '1' }, { id: '2' }, { id: '3' }],
    });
    lookup.enrichCostForCase
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('boom'));

    const res = await service.finalizePeriod('BR', '2026-09-01', '2026-09-30');

    expect(res).toEqual({ journalCases: 3, enrichedCases: 1, failed: 1 });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'gp.report_from >= :from AND gp.report_to <= :to',
      { from: '2026-08-31', to: '2026-10-01' },
    );
    expect(lookup.enrichCostForCase).toHaveBeenCalledWith(expect.anything(), {
      skipRemote: true,
      notifyProjector: true,
    });
  });

  it('không có journal trong kỳ thì không truy vấn phiếu', async () => {
    const { service, caseRepo } = build({ ids: [] });

    const res = await service.finalizePeriod('BR', '2026-09-01', '2026-09-30');

    expect(res).toEqual({ journalCases: 0, enrichedCases: 0, failed: 0 });
    expect(caseRepo.find).not.toHaveBeenCalled();
  });
});
