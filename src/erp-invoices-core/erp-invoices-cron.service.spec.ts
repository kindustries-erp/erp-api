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

  describe('autoSyncCurrentMonth - lookback & partial failures', () => {
    beforeEach(() => {
      jest.spyOn(cronUtil, 'isGdtInvoiceCronEnabled').mockReturnValue(true);
      jest.spyOn(cronUtil, 'isWithinInvoiceSyncWindow').mockReturnValue(true);
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'valid-token',
        cookies: 'c',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(true);
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return {} as any;
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('looks back 35 days from today in Vietnam time, so a run at 01/10 09:15 covers 30/09', async () => {
      // 2026-10-01 09:15 Việt Nam = 2026-10-01 02:15 UTC
      jest.useFakeTimers({ doNotFake: ['setTimeout'] });
      jest.setSystemTime(new Date('2026-10-01T02:15:00Z'));

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'purchase',
          dateFrom: '2026-08-27',
          dateTo: '2026-10-01',
        }),
        undefined,
        true,
      );
      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sold',
          dateFrom: '2026-08-27',
          dateTo: '2026-10-01',
        }),
        undefined,
        true,
      );
    });

    it('still syncs sold invoices when purchase sync throws', async () => {
      erpInvoicesCoreService.syncFromPortal
        .mockRejectedValueOnce(new Error('GDT 500'))
        .mockResolvedValueOnce({ failedSegments: [] });

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledTimes(2);
      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'sold' }),
        undefined,
        true,
      );
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'WARNING',
          message: expect.stringContaining('lỗi: GDT 500'),
        }),
      );
    });

    it('notifies users when a sync reports failed segments or amount conflicts', async () => {
      erpInvoicesCoreService.syncFromPortal
        .mockResolvedValueOnce({
          failedSegments: ['/query/invoices/purchase ngày 01/10/2026'],
          identityConflicts: [
            {
              invoiceNo: '1',
              serialNo: 'K26',
              existingTotal: '1',
              newTotal: '2',
            },
          ],
        })
        .mockResolvedValueOnce({ failedSegments: [] });

      await cronService.autoSyncCurrentMonth();

      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'WARNING',
          message: expect.stringContaining('mua vào: 1 phần lỗi'),
        }),
      );
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
