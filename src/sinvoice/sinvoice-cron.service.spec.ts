import { SinvoiceCronService } from './sinvoice-cron.service';
import { Logger, UnauthorizedException } from '@nestjs/common';
import * as cronUtil from '../common/utils/cron.util';

describe('SinvoiceCronService', () => {
  let cronService: SinvoiceCronService;
  let sinvoiceService: any;
  let notificationsService: any;
  let permissionRepo: any;
  let userRoleRepo: any;

  beforeEach(() => {
    sinvoiceService = {
      syncDraftsFromViettel: jest.fn().mockResolvedValue({
        changed: true,
        synced: 10,
        added: 2,
        removed: 0,
      }),
    };
    notificationsService = {
      createForUser: jest.fn().mockResolvedValue({}),
    };
    permissionRepo = {
      find: jest.fn().mockResolvedValue([{ roleId: 'role-1' }]),
    };
    userRoleRepo = {
      find: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
    };

    cronService = new SinvoiceCronService(
      sinvoiceService,
      notificationsService,
      permissionRepo,
      userRoleRepo,
    );

    (cronService as any).logger = new Logger();
    jest.spyOn((cronService as any).logger, 'log').mockImplementation(() => {});
    jest
      .spyOn((cronService as any).logger, 'warn')
      .mockImplementation(() => {});
    jest
      .spyOn((cronService as any).logger, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cronService.onModuleDestroy();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should not set heartbeat interval if invoice cron is disabled', () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(false);

      cronService.onModuleInit();

      expect((cronService as any).intervalId).toBeUndefined();
    });

    it('should set heartbeat interval if invoice cron is enabled', () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(true);

      cronService.onModuleInit();

      expect((cronService as any).intervalId).toBeDefined();
    });
  });

  describe('autoSyncDrafts', () => {
    it('should skip sync if invoice cron is disabled', async () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(false);

      await cronService.autoSyncDrafts();

      expect(sinvoiceService.syncDraftsFromViettel).not.toHaveBeenCalled();
    });

    it('should sync drafts and notify if invoice cron is enabled and changes occurred', async () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(true);

      await cronService.autoSyncDrafts();

      expect(sinvoiceService.syncDraftsFromViettel).toHaveBeenCalled();
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'INFO' }),
      );
    });

    it('should pause cron, notify admins and set auth pause flag on 401/403 Unauthorized error', async () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(true);
      sinvoiceService.syncDraftsFromViettel.mockRejectedValue(
        new UnauthorizedException('HTTP 401 Unauthorized'),
      );

      await cronService.autoSyncDrafts();

      expect(sinvoiceService.syncDraftsFromViettel).toHaveBeenCalled();
      expect(cronService.isAuthPaused()).toBe(true);
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'ERROR',
          title: expect.stringContaining('Sai mật khẩu'),
        }),
      );

      // Verify resume
      cronService.resumeAfterPasswordUpdate();
      expect(cronService.isAuthPaused()).toBe(false);
    });
  });
});
