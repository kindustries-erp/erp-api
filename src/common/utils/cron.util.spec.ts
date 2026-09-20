import {
  isCronEnabled,
  isInvoiceCronEnabled,
  isGdtInvoiceCronEnabled,
  isWithinInvoiceSyncWindow,
  isWithinSyncWindow,
  getNextSyncSlot,
  getNextInvoiceSyncSlot,
  getSyncSlotKey,
  isAuthError,
  runSafeCronJob,
} from './cron.util';

describe('cron.util', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isCronEnabled', () => {
    it('returns true when ENABLE_CRON is "true"', () => {
      process.env.ENABLE_CRON = 'true';
      expect(isCronEnabled()).toBe(true);
    });

    it('returns false when ENABLE_CRON is "false"', () => {
      process.env.ENABLE_CRON = 'false';
      expect(isCronEnabled()).toBe(false);
    });

    it('returns true when APP_ENV ends with -production', () => {
      delete process.env.ENABLE_CRON;
      process.env.APP_ENV = 'vn-production';
      expect(isCronEnabled()).toBe(true);
    });

    it('returns true when NODE_ENV is production', () => {
      delete process.env.ENABLE_CRON;
      delete process.env.APP_ENV;
      process.env.NODE_ENV = 'production';
      expect(isCronEnabled()).toBe(true);
    });

    it('returns false in local development without explicit enable', () => {
      delete process.env.ENABLE_CRON;
      process.env.APP_ENV = 'local';
      process.env.NODE_ENV = 'development';
      expect(isCronEnabled()).toBe(false);
    });
  });

  describe('isInvoiceCronEnabled & isGdtInvoiceCronEnabled', () => {
    it('returns false when global cron is disabled even if ENABLE_INVOICE_CRON is true', () => {
      process.env.ENABLE_CRON = 'false';
      process.env.ENABLE_INVOICE_CRON = 'true';
      expect(isInvoiceCronEnabled()).toBe(false);
      expect(isGdtInvoiceCronEnabled()).toBe(false);
    });

    it('returns true by default when global cron is enabled and ENABLE_INVOICE_CRON is unset', () => {
      process.env.ENABLE_CRON = 'true';
      delete process.env.ENABLE_INVOICE_CRON;
      expect(isInvoiceCronEnabled()).toBe(true);
      expect(isGdtInvoiceCronEnabled()).toBe(true);
    });

    it('returns false when ENABLE_INVOICE_CRON is "false"', () => {
      process.env.ENABLE_CRON = 'true';
      process.env.ENABLE_INVOICE_CRON = 'false';
      expect(isInvoiceCronEnabled()).toBe(false);
      expect(isGdtInvoiceCronEnabled()).toBe(false);
    });
  });

  describe('isWithinSyncWindow (03:15, 09:15, 15:15 Asia/Ho_Chi_Minh GMT+7)', () => {
    it('returns true at 03:15, 09:15, 15:15 in VN timezone', () => {
      // 03:15 VN (GMT+7) = 20:15 UTC ngày hôm trước
      expect(isWithinSyncWindow(new Date('2026-09-19T20:15:00.000Z'))).toBe(
        true,
      );
      // 03:45 VN
      expect(isWithinSyncWindow(new Date('2026-09-19T20:45:00.000Z'))).toBe(
        true,
      );
      // 09:15 VN = 02:15 UTC
      expect(isWithinSyncWindow(new Date('2026-09-20T02:15:00.000Z'))).toBe(
        true,
      );
      // 15:15 VN = 08:15 UTC
      expect(isWithinSyncWindow(new Date('2026-09-20T08:15:00.000Z'))).toBe(
        true,
      );
      // Alias check
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-20T08:15:00.000Z')),
      ).toBe(true);
    });

    it('returns false before minute 15 during sync hours', () => {
      // 03:00 VN (20:00 UTC) -> trước 03:15
      expect(isWithinSyncWindow(new Date('2026-09-19T20:00:00.000Z'))).toBe(
        false,
      );
      // 09:14 VN (02:14 UTC) -> trước 09:15
      expect(isWithinSyncWindow(new Date('2026-09-20T02:14:59.000Z'))).toBe(
        false,
      );
      // 15:05 VN (08:05 UTC) -> trước 15:15
      expect(isWithinSyncWindow(new Date('2026-09-20T08:05:00.000Z'))).toBe(
        false,
      );
    });

    it('returns false outside 03h, 09h, 15h', () => {
      // 10:15 VN (03:15 UTC)
      expect(isWithinSyncWindow(new Date('2026-09-20T03:15:00.000Z'))).toBe(
        false,
      );
      // 00:15 VN (17:15 UTC) - DB Backup time
      expect(isWithinSyncWindow(new Date('2026-09-20T17:15:00.000Z'))).toBe(
        false,
      );
      // 21:15 VN (14:15 UTC)
      expect(isWithinSyncWindow(new Date('2026-09-20T14:15:00.000Z'))).toBe(
        false,
      );
    });
  });

  describe('getNextSyncSlot', () => {
    it('calculates next slot correctly within the same day', () => {
      // 02:00 VN -> next is 03:15
      const res1 = getNextSyncSlot(new Date('2026-09-20T19:00:00.000Z'));
      expect(res1.slotHour).toBe(3);
      expect(res1.slotMinute).toBe(15);
      expect(res1.slotLabel).toBe('03:15');

      // 05:00 VN -> next is 09:15
      const res2 = getNextSyncSlot(new Date('2026-09-20T22:00:00.000Z'));
      expect(res2.slotHour).toBe(9);
      expect(res2.slotLabel).toBe('09:15');

      // 10:00 VN -> next is 15:15
      const res3 = getNextInvoiceSyncSlot(new Date('2026-09-20T03:00:00.000Z'));
      expect(res3.slotHour).toBe(15);
      expect(res3.slotLabel).toBe('15:15');
    });

    it('wraps around to 03:15 next day when after 15:15', () => {
      // 16:00 VN (09:00 UTC) -> next is 03:15 next day
      const res = getNextSyncSlot(new Date('2026-09-20T09:00:00.000Z'));
      expect(res.slotHour).toBe(3);
      expect(res.slotLabel).toBe('03:15');
      expect(res.nextSlotDate.getDate()).toBe(21);
    });
  });

  describe('getSyncSlotKey', () => {
    it('formats slot key properly as YYYY-MM-DD_HH15', () => {
      // 09:20 VN on 2026-09-20
      const keyInfo = getSyncSlotKey(new Date('2026-09-20T02:20:00.000Z'));
      expect(keyInfo.key).toBe('2026-09-20_0915');
      expect(keyInfo.hour).toBe(9);
    });
  });

  describe('isAuthError', () => {
    it('identifies status 401 and 403 as auth error', () => {
      expect(isAuthError({ status: 401, message: 'Unauthorized' })).toBe(true);
      expect(isAuthError({ statusCode: 403, message: 'Forbidden' })).toBe(true);
      expect(isAuthError({ response: { status: 401 } })).toBe(true);
    });

    it('identifies password and credential keywords as auth error', () => {
      expect(isAuthError(new Error('Sai mật khẩu hoặc tên đăng nhập'))).toBe(
        true,
      );
      expect(isAuthError(new Error('Invalid password or credentials'))).toBe(
        true,
      );
      expect(isAuthError(new Error('gdt_auth_failed'))).toBe(true);
    });

    it('returns false for generic network or system errors', () => {
      expect(isAuthError(new Error('ECONNRESET'))).toBe(false);
      expect(isAuthError(new Error('Database timeout'))).toBe(false);
      expect(isAuthError(null)).toBe(false);
    });
  });

  describe('runSafeCronJob', () => {
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
    });

    it('skips execution when checkEnabled returns false', async () => {
      const execute = jest.fn();
      const res = await runSafeCronJob({
        jobName: 'TestJob',
        logger: mockLogger,
        checkEnabled: () => false,
        execute,
      });

      expect(res.executed).toBe(false);
      expect(execute).not.toHaveBeenCalled();
    });

    it('skips execution and logs warning when isPaused returns true', async () => {
      const execute = jest.fn();
      const res = await runSafeCronJob({
        jobName: 'TestJob',
        logger: mockLogger,
        isPaused: () => true,
        execute,
      });

      expect(res.executed).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Bỏ qua chu kỳ chạy do đang tạm dừng'),
      );
    });

    it('executes successfully and triggers onSuccess callback', async () => {
      const execute = jest.fn().mockResolvedValue({ total: 5 });
      const onSuccess = jest.fn();

      const res = await runSafeCronJob({
        jobName: 'TestJob',
        logger: mockLogger,
        execute,
        onSuccess,
      });

      expect(res.executed).toBe(true);
      expect(res.success).toBe(true);
      expect(res.result).toEqual({ total: 5 });
      expect(onSuccess).toHaveBeenCalledWith({ total: 5 }, expect.any(Number));
    });

    it('catches auth error, triggers onAuthError callback, and does not throw', async () => {
      const execute = jest.fn().mockRejectedValue({
        status: 401,
        message: 'Sai mật khẩu Cổng Thuế',
      });
      const onAuthError = jest.fn();
      const onError = jest.fn();

      const res = await runSafeCronJob({
        jobName: 'GdtSync',
        logger: mockLogger,
        execute,
        onAuthError,
        onError,
      });

      expect(res.executed).toBe(true);
      expect(res.success).toBe(false);
      expect(onAuthError).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Zero-Lockout Guard'),
      );
    });

    it('catches general error, triggers onError callback, and does not throw', async () => {
      const execute = jest.fn().mockRejectedValue(new Error('Network timeout'));
      const onAuthError = jest.fn();
      const onError = jest.fn();

      const res = await runSafeCronJob({
        jobName: 'KgaraSync',
        logger: mockLogger,
        execute,
        onAuthError,
        onError,
      });

      expect(res.executed).toBe(true);
      expect(res.success).toBe(false);
      expect(onError).toHaveBeenCalled();
      expect(onAuthError).not.toHaveBeenCalled();
    });
  });
});
