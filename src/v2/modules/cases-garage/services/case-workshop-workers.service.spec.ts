import { CaseWorkshopWorkersService } from './case-workshop-workers.service';

function make(links: { branchId: string }[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'take']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue([
    {
      id: 'e1',
      employeeCode: 'NV01',
      fullName: 'Thợ A',
      jobTitle: 'KTV',
    },
  ]);
  const find = jest.fn().mockResolvedValue(links);
  const ds = {
    getRepository: (e: { name: string }) =>
      e.name === 'BranchManagementExternalLink'
        ? { find }
        : { createQueryBuilder: () => qb },
  };
  return { svc: new CaseWorkshopWorkersService(ds as never), qb, find };
}

const sqls = (qb: Record<string, jest.Mock>) =>
  qb.andWhere.mock.calls.map((c) => String(c[0]));

describe('CaseWorkshopWorkersService', () => {
  it('lọc theo chi nhánh ERP liên kết KGara (kèm nhân viên chưa gán), tìm tên/mã, chỉ ACTIVE', async () => {
    const { svc, qb, find } = make([{ branchId: 'b1' }, { branchId: 'b1' }]);
    const res = await svc.list('KG1', ' an ');
    expect(find.mock.calls[0][0]).toMatchObject({
      where: { source: 'KGARA', externalId: 'KG1', isDeleted: false },
    });
    const branchCall = qb.andWhere.mock.calls.find((c) =>
      String(c[0]).includes('e.branch_id IN'),
    );
    expect(branchCall?.[1]).toEqual({ branchIds: ['b1'] });
    expect(sqls(qb)).toContain(`e.status = 'ACTIVE'`);
    const searchCall = qb.andWhere.mock.calls.find((c) =>
      String(c[0]).includes('ILIKE'),
    );
    expect(searchCall?.[1]).toEqual({ q: '%an%' });
    expect(qb.take).toHaveBeenCalledWith(30);
    expect(res.items).toEqual([
      { id: 'e1', code: 'NV01', fullName: 'Thợ A', jobTitle: 'KTV' },
    ]);
  });

  it('chưa có liên kết chi nhánh và không tìm: không lọc chi nhánh, không ILIKE', async () => {
    const { svc, qb } = make([]);
    await svc.list('KG1');
    expect(sqls(qb).some((s) => s.includes('branch_id'))).toBe(false);
    expect(sqls(qb).some((s) => s.includes('ILIKE'))).toBe(false);
  });
});
