import { CaseWorkshopWorkersService } from './case-workshop-workers.service';

function make() {
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
  const ds = { getRepository: () => ({ createQueryBuilder: () => qb }) };
  return { svc: new CaseWorkshopWorkersService(ds as never), qb };
}

const sqls = (qb: Record<string, jest.Mock>) =>
  qb.andWhere.mock.calls.map((c) => String(c[0]));

describe('CaseWorkshopWorkersService', () => {
  it('có chọn chi nhánh ERP: nhân viên chi nhánh đó hoặc chưa gán, tìm tên/mã, chỉ ACTIVE', async () => {
    const { svc, qb } = make();
    const res = await svc.list('b1', ' an ');
    const branchCall = qb.andWhere.mock.calls.find((c) =>
      String(c[0]).includes('e.branch_id ='),
    );
    expect(String(branchCall?.[0])).toContain('e.branch_id IS NULL');
    expect(branchCall?.[1]).toEqual({ branchId: 'b1' });
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

  it('không chọn chi nhánh và không tìm: không lọc chi nhánh, không ILIKE', async () => {
    const { svc, qb } = make();
    await svc.list(undefined);
    expect(sqls(qb).some((s) => s.includes('branch_id'))).toBe(false);
    expect(sqls(qb).some((s) => s.includes('ILIKE'))).toBe(false);
  });
});
