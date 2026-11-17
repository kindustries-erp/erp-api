import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AbstractDebtSettlementService } from './abstract-debt-settlement.service';

type Row = Record<string, any>;
const DEBT = 'DebtT';
const ALLOC = 'AllocT';

/** Manager giả giữ dữ liệu trong bộ nhớ; ghi lại việc có gọi `setLock` hay không. */
function fakeManager(debts: Row[], allocs: Row[], lockSpy = jest.fn()) {
  let seq = 0;
  const allocRepo = {
    create: (r: Row) => ({ ...r }),
    save: async (r: Row) => {
      if (!r.id) {
        r.id = `a${++seq}`;
        r.createdAt = new Date();
        allocs.push(r);
      }
      return r;
    },
    findOne: async ({ where }: { where: Row }) =>
      allocs.find((a) => Object.entries(where).every(([k, v]) => a[k] === v)) ??
      null,
    createQueryBuilder: () => ({
      select: () => ({
        where: (_s: string, p: Row) => ({
          getRawOne: async () => ({
            sum: allocs
              .filter((a) => a.debtId === p.id && !a.reversedAt)
              .reduce((s, a) => s + Number(a.amount), 0),
          }),
        }),
      }),
    }),
  };
  const debtRepo = {
    save: async (r: Row) => r,
    createQueryBuilder: () => ({
      setLock: (mode: string) => {
        lockSpy(mode);
        return {
          where: (_s: string, p: Row) => ({
            getOne: async () => debts.find((d) => d.id === p.debtId) ?? null,
          }),
        };
      },
    }),
  };
  return {
    getRepository: (t: string) => (t === DEBT ? debtRepo : allocRepo),
  } as unknown as EntityManager;
}

class TestSettlement extends AbstractDebtSettlementService {
  protected readonly debtTarget = DEBT as never;
  protected readonly allocationTarget = ALLOC as never;
}

function setup(original = '1000.00') {
  const debts = [
    {
      id: 'd1',
      branchExternalId: 'B1',
      originalAmount: original,
      settledAmount: '0.00',
      balanceAmount: original,
      status: 'OPEN',
      isDeleted: false,
    },
  ];
  const allocs: Row[] = [];
  const lock = jest.fn();
  const manager = fakeManager(debts, allocs, lock);
  return { svc: new TestSettlement(), manager, debts, allocs, lock };
}

const cmd = (over: Row = {}) => ({
  debtId: 'd1',
  sourceType: 'CASHFLOW_VOUCHER' as const,
  sourceId: 'v1',
  amount: 300,
  idempotencyKey: 'k1',
  ...over,
});

describe('AbstractDebtSettlementService', () => {
  it('apply khóa pessimistic_write, ghi phân bổ và cập nhật số dư', async () => {
    const { svc, manager, debts, lock } = setup();
    const res = await svc.apply(manager, cmd());
    expect(lock).toHaveBeenCalledWith('pessimistic_write');
    expect(res.replayed).toBe(false);
    expect(res.balance).toMatchObject({ allocated: 300, balance: 700 });
    expect(debts[0]).toMatchObject({
      settledAmount: '300.00',
      balanceAmount: '700.00',
      status: 'OPEN',
    });
  });

  it('gửi lại cùng idempotencyKey không trừ nợ lần hai', async () => {
    const { svc, manager, allocs } = setup();
    await svc.apply(manager, cmd());
    const again = await svc.apply(manager, cmd());
    expect(again.replayed).toBe(true);
    expect(allocs).toHaveLength(1);
    expect(again.balance.balance).toBe(700);
  });

  it('từ chối phân bổ vượt số dư (409), cho phép khi allowOverpay', async () => {
    const { svc, manager } = setup('100.00');
    await expect(svc.apply(manager, cmd({ amount: 150 }))).rejects.toThrow(
      ConflictException,
    );
    const ok = await svc.apply(
      manager,
      cmd({ amount: 150, allowOverpay: true }),
    );
    expect(ok.balance).toMatchObject({ overpaid: 50, balance: 0 });
  });

  it('hết nợ thì status SETTLED', async () => {
    const { svc, manager, debts } = setup('300.00');
    await svc.apply(manager, cmd());
    expect(debts[0].status).toBe('SETTLED');
  });

  it('reverse hoàn số dư, gửi lại không đảo hai lần, đảo lần hai bị 409', async () => {
    const { svc, manager, allocs, debts } = setup();
    const applied = await svc.apply(manager, cmd());
    const rev = { allocationId: applied.allocation.id, idempotencyKey: 'r1' };
    const first = await svc.reverse(manager, rev);
    expect(first.balance.balance).toBe(1000);
    expect(debts[0].balanceAmount).toBe('1000.00');
    const replay = await svc.reverse(manager, rev);
    expect(replay.replayed).toBe(true);
    expect(allocs).toHaveLength(2);
    await expect(
      svc.reverse(manager, { ...rev, idempotencyKey: 'r2' }),
    ).rejects.toThrow(ConflictException);
  });

  it('recalculate tính lại từ phân bổ chưa đảo', async () => {
    const { svc, manager, debts } = setup();
    await svc.apply(manager, cmd());
    debts[0].balanceAmount = '1.00';
    const b = await svc.recalculate(manager, 'd1');
    expect(b.balance).toBe(700);
    expect(debts[0].balanceAmount).toBe('700.00');
  });

  it('khoản nợ không tồn tại thì 404', async () => {
    const { svc, manager } = setup();
    await expect(svc.apply(manager, cmd({ debtId: 'zzz' }))).rejects.toThrow(
      NotFoundException,
    );
  });
});
