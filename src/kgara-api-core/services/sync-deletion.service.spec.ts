import { SyncDeletionService } from './sync-deletion.service';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

const BRANCH = '0b4d6d3a-55df-492b-abaf-377d84b61d05';

describe('SyncDeletionService scope', () => {
  let service: SyncDeletionService;
  let andWhere: jest.Mock;
  let getMany: jest.Mock;
  let save: jest.Mock;
  let linkedCount: jest.Mock;

  beforeEach(() => {
    andWhere = jest.fn();
    getMany = jest.fn().mockResolvedValue([]);
    const qb: any = {
      leftJoin: jest.fn(),
      where: jest.fn(),
      andWhere,
      getMany,
    };
    qb.leftJoin.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
    save = jest.fn();
    linkedCount = jest.fn().mockResolvedValue(0);
    service = new SyncDeletionService(
      { createQueryBuilder: jest.fn().mockReturnValue(qb), save } as any,
      { count: linkedCount } as any,
    );
  });

  const conditions = () => andWhere.mock.calls.map((c) => String(c[0]));

  it('OJ scope filters only by the case account, not by classification', async () => {
    await service.detectAndMarkDeletedCases(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      new Set(),
      KgaraAccountKey.OJ,
    );

    expect(conditions()).toContain('case.accountKey = :accountKey');
    expect(conditions().join(' ')).not.toMatch(/classification|OJ_NGOAI/);
    expect(andWhere).toHaveBeenCalledWith('case.accountKey = :accountKey', {
      accountKey: 'OJ',
    });
  });

  it('MAIN scope keeps its existing account filter', async () => {
    await service.detectAndMarkDeletedCases(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      new Set(),
      KgaraAccountKey.MAIN,
    );

    expect(conditions().join(' ')).toContain(
      'case.accountKey = :accountKey OR case.accountKey IS NULL',
    );
  });

  it('counts a miss only for cases returned by the scoped query and not seen in the sync', async () => {
    const missing = {
      id: 'a',
      hdPhieuDichVuId: 'uuid-missing',
      kgaraDeleteCount: 0,
      kgaraDeletedAt: null,
    };
    const seen = {
      id: 'b',
      hdPhieuDichVuId: 'uuid-seen',
      kgaraDeleteCount: 0,
      kgaraDeletedAt: null,
    };
    getMany.mockResolvedValue([missing, seen]);

    const result = await service.detectAndMarkDeletedCases(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      new Set(['uuid-seen']),
      KgaraAccountKey.OJ,
    );

    expect(result.deletedCount).toBe(1);
    expect(missing.kgaraDeleteCount).toBe(1);
    expect(seen.kgaraDeleteCount).toBe(0);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
