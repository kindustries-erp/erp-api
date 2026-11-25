import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressLogKind } from '../entities/case-progress.enums';
import { CaseWorkshopQueryService } from './case-workshop-query.service';

const NOW = new Date('2026-11-24T10:00:00.000Z');

function make() {
  const openRows = [
    {
      caseId: 'c1',
      kind: CaseProgressLogKind.STAGE,
      stage: 'PAINTING',
      workerName: 'Thợ A',
      startedAt: new Date('2026-11-24T09:00:00.000Z'),
      endedAt: null,
    },
  ];
  const noteRows = [
    {
      caseId: 'c1',
      kind: CaseProgressLogKind.NOTE,
      note: 'Đã gọi khách',
      startedAt: new Date('2026-11-24T09:30:00.000Z'),
    },
  ];
  const builders: Record<string, jest.Mock>[] = [];
  const qb = () => {
    const b: Record<string, jest.Mock> = {};
    for (const m of [
      'distinctOn',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
    ]) {
      b[m] = jest.fn().mockReturnValue(b);
    }
    b.getMany = jest.fn(async () =>
      b.distinctOn.mock.calls.length ? noteRows : openRows,
    );
    builders.push(b);
    return b;
  };
  const find = jest.fn().mockResolvedValue([
    {
      id: 'l2',
      caseId: 'c1',
      kind: CaseProgressLogKind.STAGE,
      stage: 'PAINTING',
      startedAt: new Date('2026-11-24T09:00:00.000Z'),
      endedAt: null,
    },
  ]);
  const ds = {
    manager: {},
    getRepository: () => ({ createQueryBuilder: qb, find }),
  };
  const progress = {
    findPage: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'c1',
          status: CaseStatus.IN_PROGRESS,
          receivedAt: '2026-11-24T08:00:00.000Z',
          startedAt: null,
          completedAt: null,
          workshopTrackedAt: null,
          origin: 'NATIVE',
        },
        {
          id: 'c2',
          status: CaseStatus.INTAKE,
          receivedAt: null,
          startedAt: null,
          completedAt: null,
          workshopTrackedAt: null,
          origin: 'NATIVE',
        },
      ],
      pagination: { page: 1, pageSize: 200, total: 2, totalPages: 1 },
    }),
  };
  const cases = { findOwned: jest.fn().mockResolvedValue({ id: 'c1' }) };
  return {
    svc: new CaseWorkshopQueryService(
      ds as never,
      progress as never,
      cases as never,
    ),
    progress,
    cases,
    find,
    builders,
  };
}

describe('CaseWorkshopQueryService', () => {
  it('board: lấy mọi status, xe đã xong trong 7 ngày mặc định, ghép công đoạn mở và ghi chú mới nhất', async () => {
    const { svc, progress } = make();
    const res = await svc.board('B1', { search: '51A' }, NOW);
    const [branch, q, now, opts] = progress.findPage.mock.calls[0];
    expect(branch).toBe('B1');
    expect(q).toMatchObject({
      status: 'ALL',
      page: 1,
      pageSize: 200,
      search: '51A',
    });
    expect(now).toBe(NOW);
    expect(opts.finishedSince).toEqual(new Date('2026-11-17T10:00:00.000Z'));
    expect(opts.trackedOnly).toBe(true);
    expect(res.items[0]).toMatchObject({
      id: 'c1',
      stageStartedAt: '2026-11-24T09:00:00.000Z',
      stageElapsedMinutes: 60,
      totalElapsedMinutes: 120,
      stageWorkerName: 'Thợ A',
      lastNote: 'Đã gọi khách',
    });
    expect(res.items[1]).toMatchObject({
      id: 'c2',
      stageStartedAt: null,
      lastNote: null,
    });
    expect(res.pagination.total).toBe(2);
  });

  it('board: finishedDays tùy chỉnh', async () => {
    const { svc, progress } = make();
    await svc.board('B1', { finishedDays: 1 }, NOW);
    expect(progress.findPage.mock.calls[0][3].finishedSince).toEqual(
      new Date('2026-11-23T10:00:00.000Z'),
    );
  });

  it('timeline: kiểm xe thuộc chi nhánh, lọc đã xóa, mới nhất trước', async () => {
    const { svc, cases, find } = make();
    const items = await svc.timeline('B1', 'c1', NOW);
    expect(cases.findOwned).toHaveBeenCalledWith({}, 'B1', 'c1');
    expect(find.mock.calls[0][0]).toMatchObject({
      where: { caseId: 'c1', branchExternalId: 'B1', isDeleted: false },
      order: { startedAt: 'DESC' },
    });
    expect(items[0]).toMatchObject({ id: 'l2', durationMinutes: 60 });
  });
});
