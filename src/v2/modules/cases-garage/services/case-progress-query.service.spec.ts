import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressQueryService } from './case-progress-query.service';

function make(rows: Record<string, unknown>[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([rows, rows.length]);
  const emp = {
    createQueryBuilder: () => ({
      where: () => ({ getMany: async () => [{ id: 'e1', fullName: 'KTV A' }] }),
    }),
  };
  const line = {
    createQueryBuilder: () => {
      const b: Record<string, unknown> = {};
      b.where = () => b;
      b.andWhere = () => b;
      b.orderBy = () => b;
      b.getMany = async () => [
        {
          caseId: 'c2',
          description: 'Thay nhớt',
          overrides: {},
          lineNumber: 1,
        },
        {
          caseId: 'c2',
          description: 'Đã xóa',
          overrides: { _deleted: true },
          lineNumber: 2,
        },
      ];
      return b;
    },
  };
  const repo = { createQueryBuilder: () => qb };
  const ds = {
    getRepository: (e: { name: string }) =>
      e.name === 'CaseGarage'
        ? repo
        : e.name === 'EmployeeManagement'
          ? emp
          : line,
  };
  return { svc: new CaseProgressQueryService(ds as never), qb };
}

const now = new Date('2026-11-22T10:00:00Z');

describe('CaseProgressQueryService', () => {
  it('mặc định lọc IN_PROGRESS; map tên KTV, tóm tắt dòng, quá hạn, thời gian đã làm', async () => {
    const { svc, qb } = make([
      {
        id: 'c1',
        caseCode: 'A',
        status: CaseStatus.IN_PROGRESS,
        assigneeId: 'e1',
        requestDescription: 'Sơn cản',
        startedAt: new Date('2026-11-22T09:00:00Z'),
        expectedCompletionAt: new Date('2026-11-22T09:30:00Z'),
        overrides: {},
      },
      {
        id: 'c2',
        caseCode: 'B',
        status: CaseStatus.IN_PROGRESS,
        assigneeId: null,
        requestDescription: null,
        receivedAt: new Date('2026-11-22T08:00:00Z'),
        overrides: {},
      },
    ]);
    const r = await svc.findPage('B1', {}, now);
    expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', {
      status: 'IN_PROGRESS',
    });
    expect(r.items[0]).toMatchObject({
      assigneeName: 'KTV A',
      workSummary: 'Sơn cản',
      elapsedMinutes: 60,
      isOverdue: true,
    });
    expect(r.items[1]).toMatchObject({
      workSummary: 'Thay nhớt',
      elapsedMinutes: 120,
      isOverdue: false,
    });
    expect(r.pagination.total).toBe(2);
  });

  it('status ALL bỏ lọc trạng thái; lọc KTV, công đoạn, quá hạn', async () => {
    const { svc, qb } = make([]);
    await svc.findPage(
      'B1',
      { status: 'ALL', assigneeId: 'e1', stage: 'QC' as never, overdue: true },
      now,
    );
    const sqls = qb.andWhere.mock.calls.map((c) => c[0] as string);
    expect(sqls).not.toContain('c.status = :status');
    expect(sqls).toEqual(
      expect.arrayContaining([
        'c.assignee_id = :a',
        'c.progress_stage = :stage',
        'c.expected_completion_at < :now',
      ]),
    );
  });
});
