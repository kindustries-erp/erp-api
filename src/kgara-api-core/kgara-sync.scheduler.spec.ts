import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraSyncScheduler } from './kgara-sync.scheduler';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { CoreUser } from '../users/entities/core-user.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('KgaraSyncScheduler', () => {
  let scheduler: KgaraSyncScheduler;
  let branchRepo: any;
  let userRepo: any;
  let syncService: any;
  let notificationsService: any;

  beforeEach(async () => {
    const mockQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ id: 'admin-1', username: 'admin' }]),
    };

    branchRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'b1', externalId: 'BRANCH-HN', name: 'Chi nhánh Hà Nội' },
        ]),
    };

    userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    syncService = {
      getIncrementalWatermark: jest
        .fn()
        .mockResolvedValue('2026-08-01T00:00:00Z'),
      syncCasesForBranch: jest.fn().mockResolvedValue({
        deletedCount: 0,
        withLinkedInvoices: [],
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
          provide: getRepositoryToken(CoreUser),
          useValue: userRepo,
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

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('should execute hourly sync check successfully when no cases are deleted', async () => {
    await scheduler.runHourlySyncCheck();

    expect(branchRepo.find).toHaveBeenCalled();
    expect(syncService.getIncrementalWatermark).toHaveBeenCalledWith(
      'BRANCH-HN',
      '/api/v1/gr/cases/list',
    );
    expect(syncService.syncCasesForBranch).toHaveBeenCalled();
    expect(notificationsService.createForUser).not.toHaveBeenCalled();
  });

  it('should send INFO notification when cases are deleted without linked invoices', async () => {
    syncService.syncCasesForBranch.mockResolvedValueOnce({
      deletedCount: 2,
      withLinkedInvoices: [],
    });

    await scheduler.runHourlySyncCheck();

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

    await scheduler.runHourlySyncCheck();

    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        title: 'Kgara Sync Alert',
        type: 'WARNING',
      }),
    );
  });

  it('should handle errors gracefully and notify admins with ERROR type', async () => {
    syncService.syncCasesForBranch.mockRejectedValueOnce(
      new Error('Connection timeout'),
    );

    await scheduler.runHourlySyncCheck();

    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        title: 'Kgara Sync Error',
        type: 'ERROR',
        message: expect.stringContaining('Connection timeout'),
      }),
    );
  });
});
