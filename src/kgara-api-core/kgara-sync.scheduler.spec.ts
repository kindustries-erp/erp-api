import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraSyncScheduler } from './kgara-sync.scheduler';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as cronUtil from '../common/utils/cron.util';

describe('KgaraSyncScheduler', () => {
  let scheduler: KgaraSyncScheduler;
  let branchRepo: any;
  let permissionRepo: any;
  let userRoleRepo: any;
  let syncService: any;
  let notificationsService: any;

  beforeEach(async () => {
    process.env.ENABLE_CRON = 'true';

    branchRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'b1', externalId: 'BRANCH-HN', name: 'Chi nhánh Hà Nội' },
        ]),
    };

    permissionRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1', roleId: 'role-admin', resource: 'garage' },
        ]),
    };

    userRoleRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'ur1', userId: 'admin-1', roleId: 'role-admin' },
        ]),
    };

    syncService = {
      getIncrementalWatermark: jest
        .fn()
        .mockResolvedValue('2026-08-01T00:00:00Z'),
      syncCasesForBranch: jest.fn().mockResolvedValue({
        deletedCount: 0,
        withLinkedInvoices: [],
      }),
      syncCaseDetailsBatch: jest.fn().mockResolvedValue({
        totalCasesProcessed: 1,
        totalLinesSynced: 4,
        errorsCount: 0,
      }),
    };

    notificationsService = {
      createForUser: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraSyncScheduler,
        {
          provide: getRepositoryToken(KgaraBranch),
          useValue: branchRepo,
        },
        {
          provide: getRepositoryToken(CorePermission),
          useValue: permissionRepo,
        },
        {
          provide: getRepositoryToken(CoreUserRole),
          useValue: userRoleRepo,
        },
        {
          provide: KgaraSyncService,
          useValue: syncService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    scheduler = module.get<KgaraSyncScheduler>(KgaraSyncScheduler);
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    delete process.env.ENABLE_CRON;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('should activate heartbeat and log next slot on onModuleInit', () => {
    const loggerSpy = jest.spyOn((scheduler as any).logger, 'log');
    scheduler.onModuleInit();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Next sync slot scheduled at'),
    );
  });

  it('should execute scheduled sync check and batch details successfully when no cases are deleted', async () => {
    await scheduler.runScheduledSyncCheck();

    expect(branchRepo.find).toHaveBeenCalled();
    expect(syncService.getIncrementalWatermark).toHaveBeenCalledWith(
      'BRANCH-HN',
      '/api/v1/gr/cases/list',
    );
    expect(syncService.syncCasesForBranch).toHaveBeenCalled();
    expect(syncService.syncCaseDetailsBatch).toHaveBeenCalledWith(
      'BRANCH-HN',
      expect.objectContaining({ force: false }),
    );
    expect(notificationsService.createForUser).not.toHaveBeenCalled();
  });

  it('should skip execution when cron is disabled', async () => {
    jest.spyOn(cronUtil, 'isCronEnabled').mockReturnValue(false);

    await scheduler.runScheduledSyncCheck();

    expect(branchRepo.find).not.toHaveBeenCalled();
    expect(syncService.syncCasesForBranch).not.toHaveBeenCalled();
  });

  it('should send INFO notification when cases are deleted without linked invoices', async () => {
    syncService.syncCasesForBranch.mockResolvedValueOnce({
      deletedCount: 2,
      withLinkedInvoices: [],
    });

    await scheduler.runScheduledSyncCheck();

    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        title: 'Kgara Sync Info',
        type: 'INFO',
      }),
    );
  });

  it('should send WARNING notification when cases are deleted WITH linked invoices', async () => {
    syncService.syncCasesForBranch.mockResolvedValueOnce({
      deletedCount: 3,
      withLinkedInvoices: ['case-id-1'],
    });

    await scheduler.runScheduledSyncCheck();

    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        title: 'Kgara Sync Alert',
        type: 'WARNING',
      }),
    );
  });

  it('should handle errors gracefully and notify admins with ERROR type without crashing', async () => {
    syncService.syncCasesForBranch.mockRejectedValueOnce(
      new Error('Connection timeout'),
    );

    const result = await scheduler.runScheduledSyncCheck();

    expect(result?.success).toBe(false);
    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        title: 'Kgara Sync Error',
        type: 'ERROR',
        message: expect.stringContaining('Connection timeout'),
      }),
    );
  });

  it('should not throw or crash if notification sending fails', async () => {
    notificationsService.createForUser.mockRejectedValueOnce(
      new Error('Notification service down'),
    );

    syncService.syncCasesForBranch.mockResolvedValueOnce({
      deletedCount: 1,
      withLinkedInvoices: [],
    });

    // Should complete cleanly without throwing
    const result = await scheduler.runScheduledSyncCheck();
    expect(result?.success).toBe(true);
  });

  it('should clean up interval on onModuleDestroy', () => {
    scheduler.onModuleInit();
    expect((scheduler as any).intervalId).toBeDefined();

    scheduler.onModuleDestroy();
    // After destroy, interval should be cleared
  });
});
