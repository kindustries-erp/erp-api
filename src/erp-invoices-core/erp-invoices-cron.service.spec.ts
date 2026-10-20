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
    cronService.onModuleDestroy();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should not set heartbeat interval if GDT invoice cron is disabled', () => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(false);
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      cronService.onModuleInit();

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('should set heartbeat interval if GDT invoice cron is enabled', () => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(true);
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      cronService.onModuleInit();

      expect(setIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('autoSyncCurrentMonth', () => {
    beforeEach(() => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(true);
      jest.spyOn(cronUtil, 'isWithinInvoiceSyncWindow').mockReturnValue(true);
    });

    it('should attempt auto-relogin and notify if re-login fails for empty token', async () => {
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

    it('should pause cron and notify if auth error is thrown during auto-relogin', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'invalid-token',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(false);
      erpInvoicesCoreService.autoReloginWithRetry.mockRejectedValue(
        new Error('GDT_AUTH_FAILED: Sai mật khẩu Cổng Thuế'),
      );

      await cronService.autoSyncCurrentMonth();

      expect(cronService.isAuthPaused()).toBe(true);
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'ERROR',
          title: expect.stringContaining('Sai mật khẩu'),
        }),
      );

      // Verify subsequent runs are skipped
      erpInvoicesCoreService.getPortalConfig.mockClear();
      await cronService.autoSyncCurrentMonth();
      expect(erpInvoicesCoreService.getPortalConfig).not.toHaveBeenCalled();

      // Verify resumeAfterPasswordUpdate restores it
      cronService.resumeAfterPasswordUpdate();
      expect(cronService.isAuthPaused()).toBe(false);
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
  });
});
