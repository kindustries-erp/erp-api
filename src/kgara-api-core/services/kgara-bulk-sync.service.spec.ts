import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { KgaraBulkSyncService } from './kgara-bulk-sync.service';
import { KgaraSyncService } from '../kgara-sync.service';
import { KgaraAuthService } from '../kgara-auth.service';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

async function waitUntilDone(service: KgaraBulkSyncService) {
  for (let i = 0; i < 200 && service.getStatus().status === 'running'; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('KgaraBulkSyncService', () => {
  let service: KgaraBulkSyncService;
  let syncService: any;
  let authService: any;
  let branchRepo: any;

  beforeEach(async () => {
    syncService = {
      syncBranchesForAccounts: jest.fn().mockResolvedValue({
        success: true,
        accounts: [
          { accountKey: KgaraAccountKey.MAIN, ok: true },
          { accountKey: KgaraAccountKey.OJ, ok: true },
        ],
      }),
      syncCasesForBranch: jest
        .fn()
        .mockResolvedValue({ deletedCount: 0, withLinkedInvoices: [] }),
      syncGrossProfitForBranch: jest.fn().mockResolvedValue(undefined),
      syncCaseDetailsBatch: jest.fn().mockResolvedValue({
        totalCasesProcessed: 0,
        totalLinesSynced: 0,
        errorsCount: 0,
      }),
      syncAllInOne: jest.fn().mockResolvedValue({}),
    };

    authService = {
      getConfiguredAccounts: jest
        .fn()
        .mockReturnValue([KgaraAccountKey.MAIN, KgaraAccountKey.OJ]),
    };

    branchRepo = {
      find: jest.fn().mockResolvedValue([
        {
          externalId: 'b-main',
          accountKey: KgaraAccountKey.MAIN,
          name: 'Chi nhánh A',
        },
        {
          externalId: 'b-oj',
          accountKey: KgaraAccountKey.OJ,
          name: 'Chi nhánh B',
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraBulkSyncService,
        { provide: KgaraSyncService, useValue: syncService },
        { provide: KgaraAuthService, useValue: authService },
        { provide: getRepositoryToken(KgaraBranch), useValue: branchRepo },
      ],
    }).compile();

    service = module.get<KgaraBulkSyncService>(KgaraBulkSyncService);
    service.chunkDelayMs = 0;
  });

  it('syncs cases of every configured branch with its own account', async () => {
    service.start({ scope: 'cases', from: '2026-10-01', to: '2026-10-31' });
    await waitUntilDone(service);

    expect(syncService.syncBranchesForAccounts).toHaveBeenCalledWith([
      KgaraAccountKey.MAIN,
      KgaraAccountKey.OJ,
    ]);
    expect(syncService.syncCasesForBranch).toHaveBeenCalledWith(
      'b-main',
      '2026-10-01',
      '2026-10-31',
      undefined,
      KgaraAccountKey.MAIN,
      { exactRange: true },
    );
    expect(syncService.syncCasesForBranch).toHaveBeenCalledWith(
      'b-oj',
      '2026-10-01',
      '2026-10-31',
      undefined,
      KgaraAccountKey.OJ,
      { exactRange: true },
    );

    const status = service.getStatus();
    expect(status.status).toBe('completed');
    expect(status.totalBranches).toBe(2);
    expect(status.completedBranches).toBe(2);
    expect(status.results.every((r) => r.ok)).toBe(true);
  });

  it('tách theo tháng, tháng mới trước, mỗi tháng quét đúng khoảng (exactRange)', async () => {
    service.start({ scope: 'cases', from: '2026-08-20', to: '2026-10-05' });
    await waitUntilDone(service);

    const mainCalls = syncService.syncCasesForBranch.mock.calls
      .filter((c: unknown[]) => c[0] === 'b-main')
      .map((c: unknown[]) => [c[1], c[2], c[5]]);
    expect(mainCalls).toEqual([
      ['2026-10-01', '2026-10-05', { exactRange: true }],
      ['2026-09-01', '2026-09-30', { exactRange: true }],
      ['2026-08-20', '2026-08-31', { exactRange: true }],
    ]);
    const status = service.getStatus();
    expect(status.totalChunks).toBe(6);
    expect(status.completedChunks).toBe(6);
    expect(status.currentChunk).toBeNull();
    expect(status.failedChunks).toEqual([]);
  });

  it('một tháng lỗi: ghi failedChunks, chạy tiếp các tháng và chi nhánh còn lại', async () => {
    syncService.syncCasesForBranch.mockImplementation(
      (branch: string, from: string) =>
        branch === 'b-main' && from === '2026-09-01'
          ? Promise.reject(new Error('timeout'))
          : Promise.resolve({ deletedCount: 0, withLinkedInvoices: [] }),
    );

    service.start({ scope: 'cases', from: '2026-08-01', to: '2026-10-31' });
    await waitUntilDone(service);

    expect(syncService.syncCasesForBranch).toHaveBeenCalledTimes(6);
    const status = service.getStatus();
    expect(status.status).toBe('completed');
    expect(status.failedChunks).toEqual([
      {
        branchExternalId: 'b-main',
        accountKey: KgaraAccountKey.MAIN,
        from: '2026-09-01',
        to: '2026-09-30',
        error: 'timeout',
      },
    ]);
    expect(status.results[0]).toEqual(
      expect.objectContaining({ branchExternalId: 'b-main', ok: false }),
    );
    expect(status.results[1].ok).toBe(true);
    expect(status.message).toContain('lỗi');
  });

  it('scope all truyền exactRange và khoảng tháng xuống syncAllInOne', async () => {
    service.start({ scope: 'all', from: '2026-10-10', to: '2026-11-03' });
    await waitUntilDone(service);

    expect(syncService.syncAllInOne).toHaveBeenCalledWith(
      'b-main',
      expect.objectContaining({
        from: '2026-11-01',
        to: '2026-11-03',
        exactRange: true,
      }),
    );
    expect(syncService.syncAllInOne).toHaveBeenCalledWith(
      'b-main',
      expect.objectContaining({
        from: '2026-10-10',
        to: '2026-10-31',
        exactRange: true,
      }),
    );
  });

  it('không có from/to: một lượt như cũ, không exactRange', async () => {
    service.start({ scope: 'cases' });
    await waitUntilDone(service);

    expect(syncService.syncCasesForBranch).toHaveBeenCalledWith(
      'b-main',
      undefined,
      undefined,
      undefined,
      KgaraAccountKey.MAIN,
      { exactRange: false },
    );
    expect(service.getStatus().totalChunks).toBe(2);
  });

  it('keeps going after one branch fails and reports it', async () => {
    syncService.syncCasesForBranch
      .mockRejectedValueOnce(new Error('Kgara API Error: 500'))
      .mockResolvedValueOnce({ deletedCount: 0, withLinkedInvoices: [] });

    service.start({ scope: 'cases' });
    await waitUntilDone(service);

    const status = service.getStatus();
    expect(status.status).toBe('completed');
    expect(status.results).toEqual([
      {
        branchExternalId: 'b-main',
        accountKey: KgaraAccountKey.MAIN,
        ok: false,
        error: 'Kgara API Error: 500',
      },
      { branchExternalId: 'b-oj', accountKey: KgaraAccountKey.OJ, ok: true },
    ]);
    expect(status.message).toContain('lỗi');
  });

  it('runs gross-profit scope with the gross-profit step only', async () => {
    service.start({
      scope: 'gross-profit',
      from: '2026-10-01',
      to: '2026-10-31',
    });
    await waitUntilDone(service);

    expect(syncService.syncGrossProfitForBranch).toHaveBeenCalledTimes(2);
    expect(syncService.syncCasesForBranch).not.toHaveBeenCalled();
    expect(syncService.syncCaseDetailsBatch).not.toHaveBeenCalled();
  });

  it('runs the all scope through syncAllInOne without re-syncing branches', async () => {
    service.start({ scope: 'all', includeDetails: true, forceDetails: false });
    await waitUntilDone(service);

    expect(syncService.syncAllInOne).toHaveBeenCalledWith(
      'b-oj',
      expect.objectContaining({
        accountKey: KgaraAccountKey.OJ,
        includeDetails: true,
        forceDetails: false,
        skipBranchSync: true,
      }),
    );
  });

  it('rejects a second start while a job is running', async () => {
    service.start({ scope: 'cases' });

    expect(() => service.start({ scope: 'cases' })).toThrow(ConflictException);
    await waitUntilDone(service);
  });

  it('releases the lock when the job finishes', async () => {
    service.start({ scope: 'cases' });
    await waitUntilDone(service);

    expect(service.tryLock()).toBe(true);
    service.unlock();
  });

  it('keeps the lock taken by an external caller until it unlocks', () => {
    expect(service.tryLock()).toBe(true);
    expect(service.tryLock()).toBe(false);
    service.unlock();
    expect(service.tryLock()).toBe(true);
    service.unlock();
  });
});
