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
      createForUser: jest.fn(),
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
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should not schedule next sync if invoice cron is disabled', () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(false);
      const scheduleSpy = jest.spyOn(cronService as any, 'scheduleNextSync');

      cronService.onModuleInit();

      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('should schedule next sync if invoice cron is enabled', () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(true);
      const scheduleSpy = jest
        .spyOn(cronService as any, 'scheduleNextSync')
        .mockImplementation(() => {});

      cronService.onModuleInit();

      expect(scheduleSpy).toHaveBeenCalled();
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

    it('should catch 401/403 Unauthorized error and log error without throwing or retrying', async () => {
      jest.spyOn(cronUtil, 'isInvoiceCronEnabled').mockReturnValue(true);
      sinvoiceService.syncDraftsFromViettel.mockRejectedValue(
        new UnauthorizedException('HTTP 401 Unauthorized'),
      );

      await cronService.autoSyncDrafts();

      expect(sinvoiceService.syncDraftsFromViettel).toHaveBeenCalled();
      expect((cronService as any).logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Đăng nhập Viettel trả về lỗi xác thực (401/403)',
        ),
        expect.anything(),
      );
    });
  });
});
