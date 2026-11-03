import { planCorruptedRepairs } from './kgara-reconcile-repair.helper';

describe('planCorruptedRepairs', () => {
  const row = (id: string) => ({ hdPhieuDichVuId: id, soChungTu: null });

  it('moves OJ-tagged rows whose UUID belongs to a MAIN case back to MAIN', () => {
    const plan = planCorruptedRepairs(
      [row('m1')],
      new Set(['m1']),
      new Set<string>(),
    );
    expect(plan).toEqual({ toMain: ['m1'], staleOj: [] });
  });

  it('keeps rows that are genuinely OJ on Kgara, even if also present in MAIN', () => {
    const plan = planCorruptedRepairs(
      [row('o1')],
      new Set(['o1']),
      new Set(['o1']),
    );
    expect(plan).toEqual({ toMain: [], staleOj: [] });
  });

  it('reports but never schedules rows that exist on neither account', () => {
    const plan = planCorruptedRepairs(
      [row('x1')],
      new Set<string>(),
      new Set<string>(),
    );
    expect(plan).toEqual({ toMain: [], staleOj: ['x1'] });
  });

  it('splits a mixed list into the three buckets', () => {
    const plan = planCorruptedRepairs(
      [row('m1'), row('o1'), row('x1')],
      new Set(['m1']),
      new Set(['o1']),
    );
    expect(plan.toMain).toEqual(['m1']);
    expect(plan.staleOj).toEqual(['x1']);
  });
});
