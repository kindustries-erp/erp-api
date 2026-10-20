import { GarageCashflowDuplicateEngine } from './garage-cashflow-duplicate.engine';

function makeRepo(rowsByCall: any[][]) {
  const qbs: any[] = [];
  let call = 0;
  const repo = {
    createQueryBuilder: jest.fn(() => {
      const rows = rowsByCall[call++] ?? [];
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
      };
      qbs.push(qb);
      return qb;
    }),
  };
  return { repo, qbs };
}

const row = (o: any = {}) => ({
  id: 'v1',
  voucherCode: 'PT-1',
  voucherType: 'RECEIPT',
  amount: '1000.00',
  transDate: '2026-10-10',
  licensePlate: '51A-123.45',
  partnerName: 'A',
  case: { soChungTu: 'SC-1' },
  ...o,
});

describe('GarageCashflowDuplicateEngine', () => {
  it('normalizePlate strips separators and uppercases', () => {
    expect(GarageCashflowDuplicateEngine.normalizePlate('51a-123.45 ')).toBe(
      '51A12345',
    );
    expect(GarageCashflowDuplicateEngine.normalizePlate(undefined)).toBe('');
  });

  it('shiftDate moves by days across month boundaries', () => {
    expect(GarageCashflowDuplicateEngine.shiftDate('2026-10-03', -7)).toBe(
      '2026-09-26',
    );
    expect(GarageCashflowDuplicateEngine.shiftDate('2026-10-28', 7)).toBe(
      '2026-11-04',
    );
  });

  it('skips case/plate groups when not provided and queries only date window', async () => {
    const { repo, qbs } = makeRepo([[row()]]);
    const engine = new GarageCashflowDuplicateEngine(repo as any);
    const res = await engine.findPotentialDuplicates({
      amount: 1000,
      transDate: '2026-10-12',
    });
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(res.nearbyDate.total).toBe(1);
    expect(res.nearbyDate.items[0]).toMatchObject({
      voucherCode: 'PT-1',
      amount: 1000,
      caseCode: 'SC-1',
    });
    expect(res.sameCase).toEqual({ items: [], total: 0 });
    expect(res.samePlate).toEqual({ items: [], total: 0 });
    const params = qbs[0].where.mock.calls
      .concat(qbs[0].andWhere.mock.calls)
      .map((c: any[]) => c[1])
      .filter(Boolean);
    expect(params).toContainEqual(
      expect.objectContaining({ from: '2026-10-05', to: '2026-10-19' }),
    );
  });

  it('queries case and plate groups without date limit and applies excludeId', async () => {
    const { repo, qbs } = makeRepo([[], [row()], [row()]]);
    const engine = new GarageCashflowDuplicateEngine(repo as any);
    const res = await engine.findPotentialDuplicates({
      amount: 1000,
      transDate: '2026-10-12',
      caseId: 'case-1',
      licensePlate: '51a-123.45',
      excludeId: 'self',
    });
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(res.sameCase.total).toBe(1);
    expect(res.samePlate.total).toBe(1);
    for (const qb of qbs) {
      const sql = qb.andWhere.mock.calls.map((c: any[]) => c[0]).join(' ');
      expect(sql).toContain('v.id <> :excludeId');
    }
    const caseSql = qbs[1].andWhere.mock.calls
      .map((c: any[]) => c[0])
      .join(' ');
    expect(caseSql).not.toContain('trans_date');
    const plateSql = qbs[2].andWhere.mock.calls
      .map((c: any[]) => c[0])
      .join(' ');
    expect(plateSql).toContain('regexp_replace');
  });

  it('caps items at 5 but reports real total', async () => {
    const many = Array.from({ length: 5 }, (_, i) => row({ id: `v${i}` }));
    const { repo, qbs } = makeRepo([many]);
    qbs.length = 0;
    const engine = new GarageCashflowDuplicateEngine(repo as any);
    const res = await engine.findPotentialDuplicates({
      amount: 1000,
      transDate: '2026-10-12',
    });
    expect(res.nearbyDate.items).toHaveLength(5);
    expect(qbs[0].take).toHaveBeenCalledWith(5);
  });
});
