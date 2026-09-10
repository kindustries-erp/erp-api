import { ErpInvoicesCronService } from './erp-invoices-cron.service';
import { Logger } from '@nestjs/common';
import * as cronUtil from '../common/utils/cron.util';

describe('ErpInvoicesCronService', () => {
  let cronService: ErpInvoicesCronService;
  let erpInvoicesCoreService: any;
  let notificationsService: any;
  let permissionRepo: any;
  let userRoleRepo: any;

  beforeEach(() => {
    erpInvoicesCoreService = {
      getPortalConfig: jest.fn(),
      checkTokenValid: jest.fn(),
      autoReloginWithRetry: jest.fn(),
      syncFromPortal: jest.fn().mockResolvedValue({}),
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

    cronService = new ErpInvoicesCronService(
      erpInvoicesCoreService,
      notificationsService,
      permissionRepo,
      userRoleRepo,
    );
    // Suppress logs for tests
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
    it('should not schedule next sync if GDT invoice cron is disabled / locked', () => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(false);
      const scheduleSpy = jest.spyOn(cronService as any, 'scheduleNextSync');

      cronService.onModuleInit();

      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('should schedule next sync if GDT invoice cron is enabled', () => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(true);
      const scheduleSpy = jest
        .spyOn(cronService as any, 'scheduleNextSync')
        .mockImplementation(() => {});

      cronService.onModuleInit();

      expect(scheduleSpy).toHaveBeenCalled();
    });
  });

  describe('autoSyncCurrentMonth', () => {
    beforeEach(() => {
      // Default enabled and within window for existing sync tests
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(true);
      jest.spyOn(cronUtil, 'isWithinInvoiceSyncWindow').mockReturnValue(true);
    });

    it('should skip sync if GDT invoice cron is disabled / locked', async () => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(false);

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.getPortalConfig).not.toHaveBeenCalled();
    });

    it('should skip sync if outside allowed sync time window (00:00 - 03:59 VN)', async () => {
      jest.spyOn(cronUtil, 'isWithinInvoiceSyncWindow').mockReturnValue(false);

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.getPortalConfig).not.toHaveBeenCalled();
    });

    it('should attempt auto-relogin and skip sync if re-login fails for empty token', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({ token: '' });
      erpInvoicesCoreService.autoReloginWithRetry.mockResolvedValue(null);

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.autoReloginWithRetry).toHaveBeenCalled();
      expect(erpInvoicesCoreService.syncFromPortal).not.toHaveBeenCalled();
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'ERROR' }),
      );
    });

    it('should attempt auto-relogin and proceed with sync if re-login succeeds for empty token', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({ token: '' });
      erpInvoicesCoreService.autoReloginWithRetry.mockResolvedValue({
        token: 'new-token',
        cookies: 'new-cookies',
      });

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return {} as any;
        });

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.autoReloginWithRetry).toHaveBeenCalled();
      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'purchase',
          token: 'new-token',
          cookies: 'new-cookies',
        }),
        undefined,
        true,
      );

      setTimeoutSpy.mockRestore();
    });

    it('should notify and skip sync if token is invalid and auto-relogin fails', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'invalid-token',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(false);
      erpInvoicesCoreService.autoReloginWithRetry.mockResolvedValue(null);

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.autoReloginWithRetry).toHaveBeenCalled();
      expect(erpInvoicesCoreService.syncFromPortal).not.toHaveBeenCalled();
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'ERROR' }),
      );
    });

    it('should auto-relogin and continue sync if token is invalid but auto-relogin succeeds', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'invalid-token',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(false);
      erpInvoicesCoreService.autoReloginWithRetry.mockResolvedValue({
        token: 'refreshed-token',
        cookies: 'refreshed-cookies',
      });

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return {} as any;
        });

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.autoReloginWithRetry).toHaveBeenCalled();
      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'purchase',
          token: 'refreshed-token',
          cookies: 'refreshed-cookies',
        }),
        undefined,
        true,
      );

      setTimeoutSpy.mockRestore();
    });

    it('should sync purchase and sold invoices sequentially with valid token without re-login', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'valid-token',
        cookies: 'valid-cookies',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(true);

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return {} as any;
        });

      await cronService.autoSyncCurrentMonth();

      expect(
        erpInvoicesCoreService.autoReloginWithRetry,
      ).not.toHaveBeenCalled();
      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'purchase',
          token: 'valid-token',
          cookies: 'valid-cookies',
        }),
        undefined,
        true,
      );

      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sold',
          token: 'valid-token',
          cookies: 'valid-cookies',
        }),
        undefined,
        true,
      );

      setTimeoutSpy.mockRestore();
    });

    it('should catch GDT_TOKEN_EXPIRED error during sync and send notifications', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'valid-token',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(true);
      erpInvoicesCoreService.syncFromPortal.mockRejectedValue(
        new Error('GDT_TOKEN_EXPIRED'),
      );

      await cronService.autoSyncCurrentMonth();

      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Token GDT hóa đơn hết hạn' }),
      );
    });
  });
});
