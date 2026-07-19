import { ErpInvoicesCronService } from './erp-invoices-cron.service';
import { Logger } from '@nestjs/common';

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
  });

  describe('autoSyncCurrentMonth', () => {
    it('should skip sync if token is empty', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({ token: '' });
      await cronService.autoSyncCurrentMonth();
      expect(erpInvoicesCoreService.checkTokenValid).not.toHaveBeenCalled();
      expect(erpInvoicesCoreService.syncFromPortal).not.toHaveBeenCalled();
    });

    it('should notify and skip sync if token is invalid', async () => {
      erpInvoicesCoreService.getPortalConfig.mockResolvedValue({
        token: 'invalid-token',
      });
      erpInvoicesCoreService.checkTokenValid.mockResolvedValue(false);

      await cronService.autoSyncCurrentMonth();

      expect(erpInvoicesCoreService.syncFromPortal).not.toHaveBeenCalled();
      expect(notificationsService.createForUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'ERROR' }),
      );
    });

    it('should sync purchase and sold invoices sequentially with valid token', async () => {
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

      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'purchase', cookies: 'valid-cookies' }),
        undefined,
        true,
      );

      expect(erpInvoicesCoreService.syncFromPortal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sold', cookies: 'valid-cookies' }),
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
