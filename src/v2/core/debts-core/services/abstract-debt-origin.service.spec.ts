import type { EntityManager } from 'typeorm';
import { AbstractDebtOriginService } from './abstract-debt-origin.service';

type Row = Record<string, any>;

function fakeManager(rows: Row[], lock = jest.fn()) {
  const repo = {
    create: (r: Row) => ({ ...r }),
    save: async (r: Row) => {
      if (!r.id) {
        r.id = `d${rows.length + 1}`;
        rows.push(r);
      }
      return r;
    },
    createQueryBuilder: () => ({
      setLock: (m: string) => {
        lock(m);
        return {
          where: (_s: string, p: Row) => ({
            getOne: async () =>
              rows.find((r) =>
                ['sourceType', 'sourceId', 'direction', 'partyType'].every(
                  (k) => r[k] === p[k],
                ),
              ) ?? null,
          }),
        };
      },
    }),
  };
  return { getRepository: () => repo } as unknown as EntityManager;
}

class TestOrigin extends AbstractDebtOriginService {
  protected readonly debtTarget = 'DebtT' as never;
}

const base = {
  branchExternalId: 'B1',
  sourceType: 'CASE',
  sourceId: 'c1',
  direction: 'RECEIVABLE' as const,
  partyType: 'CUSTOMER',
  partyCode: 'KH1',
  originalAmount: 1000,
};

describe('AbstractDebtOriginService', () => {
  it('tạo dòng nợ mới với dư bằng gốc', async () => {
    const rows: Row[] = [];
    const out = await new TestOrigin().upsertOrigin(fakeManager(rows), base);
    expect(out.created).toBe(true);
    expect(rows[0]).toMatchObject({
      balanceAmount: '1000.00',
      settledAmount: '0.00',
      status: 'OPEN',
      origin: 'SYNC',
    });
  });

  it('upsert theo khóa 4 cột, giữ settledAmount, tính lại dư', async () => {
    const rows: Row[] = [];
    const svc = new TestOrigin();
    const m = fakeManager(rows);
    await svc.upsertOrigin(m, base);
    rows[0].settledAmount = '400.00';
    const out = await svc.upsertOrigin(m, { ...base, originalAmount: 900 });
    expect(out.created).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      settledAmount: '400.00',
      balanceAmount: '500.00',
    });
  });

  it('gốc về 0 thì SETTLED; upsert mở lại dòng đã VOID', async () => {
    const rows: Row[] = [];
    const svc = new TestOrigin();
    const m = fakeManager(rows);
    await svc.upsertOrigin(m, { ...base, originalAmount: 0 });
    expect(rows[0].status).toBe('SETTLED');
    rows[0].status = 'VOID';
    await svc.upsertOrigin(m, { ...base, originalAmount: 50 });
    expect(rows[0].status).toBe('OPEN');
  });

  it('voidOrigin đánh dấu VOID, trả false khi không có', async () => {
    const rows: Row[] = [];
    const svc = new TestOrigin();
    const m = fakeManager(rows);
    const key = {
      sourceType: 'CASE',
      sourceId: 'c1',
      direction: 'RECEIVABLE' as const,
      partyType: 'CUSTOMER',
    };
    expect(await svc.voidOrigin(m, key)).toBe(false);
    await svc.upsertOrigin(m, base);
    expect(await svc.voidOrigin(m, key)).toBe(true);
    expect(rows[0].status).toBe('VOID');
  });
});
