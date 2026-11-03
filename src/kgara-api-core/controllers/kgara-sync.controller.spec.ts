import { KgaraSyncController } from './kgara-sync.controller';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

const CN2 = '0b4d6d3a-55df-492b-abaf-377d84b61d05';
const CN1 = 'cn1-only';

describe('KgaraSyncController account routing', () => {
  let controller: KgaraSyncController;
  let branchRepo: { find: jest.Mock };
  let syncService: {
    syncCasesForBranch: jest.Mock;
    syncCaseDetail: jest.Mock;
    syncCaseDetailsBatch: jest.Mock;
  };

  const setBranchRows = (rows: { externalId: string; accountKey: string }[]) =>
    branchRepo.find.mockImplementation(async ({ where }: any) =>
      rows.filter((r) => r.externalId === where.externalId),
    );

  beforeEach(() => {
    branchRepo = { find: jest.fn() };
    syncService = {
      syncCasesForBranch: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      syncCaseDetail: jest.fn().mockResolvedValue({}),
      syncCaseDetailsBatch: jest.fn().mockResolvedValue({
        totalCasesProcessed: 0,
        totalLinesSynced: 0,
        errorsCount: 0,
      }),
    };
    setBranchRows([
      { externalId: CN2, accountKey: 'MAIN' },
      { externalId: CN2, accountKey: 'OJ' },
      { externalId: CN1, accountKey: 'MAIN' },
    ]);
    controller = new KgaraSyncController(
      {} as any,
      branchRepo as any,
      syncService as any,
      {} as any,
      {} as any,
    );
  });

  it('refuses to sync CN2 cases without an account, because CN2 has two accounts', async () => {
    const res: any = await controller.syncCases(
      CN2,
      {},
      undefined,
      undefined,
      undefined,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('cần tham số account');
    expect(syncService.syncCasesForBranch).not.toHaveBeenCalled();
  });

  it('passes the explicit account to syncCasesForBranch for CN2', async () => {
    await controller.syncCases(
      CN2,
      { account: 'oj' },
      undefined,
      undefined,
      undefined,
    );
    expect(syncService.syncCasesForBranch).toHaveBeenCalledWith(
      CN2,
      undefined,
      undefined,
      undefined,
      KgaraAccountKey.OJ,
    );
  });

  it('uses the only account of a single-account branch without an explicit account', async () => {
    await controller.syncCases(CN1, {}, undefined, undefined, undefined);
    expect(syncService.syncCasesForBranch).toHaveBeenCalledWith(
      CN1,
      undefined,
      undefined,
      undefined,
      KgaraAccountKey.MAIN,
    );
  });

  it('rejects an unknown account value', async () => {
    const res: any = await controller.syncCases(
      CN2,
      { account: 'XYZ' },
      undefined,
      undefined,
      undefined,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('không hợp lệ');
    expect(syncService.syncCasesForBranch).not.toHaveBeenCalled();
  });

  it('passes account to syncCaseDetail when given, and leaves it undefined otherwise', async () => {
    await controller.syncCaseDetail('case-1', CN2, 'OJ');
    expect(syncService.syncCaseDetail).toHaveBeenLastCalledWith(
      CN2,
      'case-1',
      KgaraAccountKey.OJ,
    );

    await controller.syncCaseDetail('case-2', CN2, undefined);
    expect(syncService.syncCaseDetail).toHaveBeenLastCalledWith(
      CN2,
      'case-2',
      undefined,
    );
  });

  it('passes account to the batch detail sync only when given', async () => {
    await controller.syncCaseDetailsBatch(
      CN2,
      undefined,
      undefined,
      undefined,
      undefined,
      'OJ',
    );
    expect(syncService.syncCaseDetailsBatch).toHaveBeenLastCalledWith(
      CN2,
      expect.objectContaining({ accountKey: KgaraAccountKey.OJ }),
    );

    await controller.syncCaseDetailsBatch(
      CN2,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const lastOptions = syncService.syncCaseDetailsBatch.mock.calls.at(-1)[1];
    expect(lastOptions.accountKey).toBeUndefined();
  });
});
