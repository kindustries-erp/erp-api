import { EntityManager } from 'typeorm';

import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { reconcileCaseLines } from './kgara-case-lines-reconcile.helper';

const CASE = 'case-guid-1';
const OTHER_CASE = 'case-guid-2';

function line(id: string, amount = 100) {
  return {
    detailId: id,
    data: { tienCoThue: amount } as Partial<KgaraCaseService>,
  };
}

function existing(
  id: string,
  detailId: string,
  parent = CASE,
  deletedAt: Date | null = null,
): KgaraCaseService {
  return {
    id,
    hdPhieuDichVuChiTietId: detailId,
    hdPhieuDichVuId: parent,
    deletedAt,
  } as KgaraCaseService;
}

function makeManager(
  ownRows: KgaraCaseService[],
  sameIdRows: KgaraCaseService[] = [],
) {
  const repo = {
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      'hdPhieuDichVuId' in where ? ownRows : sameIdRows,
    ),
    create: jest.fn(
      (data: Partial<KgaraCaseService>) => ({ ...data }) as KgaraCaseService,
    ),
    save: jest.fn(async (rows: KgaraCaseService[]) => rows),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const manager = {
    getRepository: jest.fn(() => repo),
  } as unknown as EntityManager;
  return { manager, repo };
}

describe('reconcileCaseLines', () => {
  it('does nothing when the Kgara payload has no line array', async () => {
    const { manager, repo } = makeManager([existing('r1', 'd1')]);
    const result = await reconcileCaseLines(manager, CASE, 'MAIN', undefined);
    expect(result).toEqual({ upserted: 0, softDeleted: 0, conflicts: [] });
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does nothing when the payload is not an array', async () => {
    const { manager, repo } = makeManager([existing('r1', 'd1')]);
    const result = await reconcileCaseLines(
      manager,
      CASE,
      'MAIN',
      null as unknown as [],
    );
    expect(result.softDeleted).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('inserts new lines and stamps account_key', async () => {
    const { manager, repo } = makeManager([]);
    const result = await reconcileCaseLines(manager, CASE, 'OJ', [
      line('d1', 50),
    ]);
    expect(result.upserted).toBe(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved).toEqual([
      expect.objectContaining({
        hdPhieuDichVuChiTietId: 'd1',
        hdPhieuDichVuId: CASE,
        tienCoThue: 50,
        accountKey: 'OJ',
        deletedAt: null,
      }),
    ]);
  });

  it('updates existing lines and restores soft-deleted ones', async () => {
    const row = existing('r1', 'd1', CASE, new Date('2026-10-01'));
    const { manager, repo } = makeManager([row]);
    await reconcileCaseLines(manager, CASE, 'MAIN', [line('d1', 999)]);
    const saved = repo.save.mock.calls[0][0][0];
    expect(saved.id).toBe('r1');
    expect(saved.tienCoThue).toBe(999);
    expect(saved.deletedAt).toBeNull();
  });

  it('soft-deletes lines of this case that Kgara no longer returns', async () => {
    const { manager, repo } = makeManager([
      existing('r1', 'd1'),
      existing('r2', 'd2'),
    ]);
    const result = await reconcileCaseLines(manager, CASE, 'MAIN', [
      line('d1'),
    ]);
    expect(result.softDeleted).toBe(1);
    expect(repo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it('does not re-delete rows that are already soft-deleted', async () => {
    const { manager, repo } = makeManager([
      existing('r1', 'd1'),
      existing('r2', 'd2', CASE, new Date('2026-10-01')),
    ]);
    const result = await reconcileCaseLines(manager, CASE, 'MAIN', [
      line('d1'),
    ]);
    expect(result.softDeleted).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('reports a conflict and does not move a line owned by another case', async () => {
    const foreign = existing('r9', 'd9', OTHER_CASE);
    const { manager, repo } = makeManager([], [foreign]);
    const result = await reconcileCaseLines(manager, CASE, 'MAIN', [
      line('d9'),
    ]);
    expect(result.conflicts).toEqual(['d9']);
    expect(result.upserted).toBe(0);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns zero counts for an empty array when the case has no stored lines', async () => {
    const { manager, repo } = makeManager([]);
    const result = await reconcileCaseLines(manager, CASE, 'MAIN', []);
    expect(result).toEqual({ upserted: 0, softDeleted: 0, conflicts: [] });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('soft-deletes every stored line when Kgara returns a valid empty array', async () => {
    const { manager, repo } = makeManager([
      existing('r1', 'd1'),
      existing('r2', 'd2'),
    ]);
    const result = await reconcileCaseLines(manager, CASE, 'MAIN', []);
    expect(result.softDeleted).toBe(2);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
