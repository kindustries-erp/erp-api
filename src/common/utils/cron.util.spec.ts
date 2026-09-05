import {
  isCronEnabled,
  isInvoiceCronEnabled,
  isGdtInvoiceCronEnabled,
  isWithinInvoiceSyncWindow,
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

  describe('isInvoiceCronEnabled', () => {
    it('returns false when global cron is disabled even if ENABLE_INVOICE_CRON is true', () => {
      process.env.ENABLE_CRON = 'false';
      process.env.ENABLE_INVOICE_CRON = 'true';
      expect(isInvoiceCronEnabled()).toBe(false);
    });

    it('returns false by default when global cron is enabled but ENABLE_INVOICE_CRON is unset (temporarily disabled)', () => {
      process.env.ENABLE_CRON = 'true';
      delete process.env.ENABLE_INVOICE_CRON;
      expect(isInvoiceCronEnabled()).toBe(false);
    });

    it('returns false when ENABLE_INVOICE_CRON is "false"', () => {
      process.env.ENABLE_CRON = 'true';
      process.env.ENABLE_INVOICE_CRON = 'false';
      expect(isInvoiceCronEnabled()).toBe(false);
    });

    it('returns true when global cron is enabled and ENABLE_INVOICE_CRON is explicitly "true"', () => {
      process.env.ENABLE_CRON = 'true';
      process.env.ENABLE_INVOICE_CRON = 'true';
      expect(isInvoiceCronEnabled()).toBe(true);
    });
  });

  describe('isGdtInvoiceCronEnabled', () => {
    it('always returns false because it is hard-locked in code for password setup', () => {
      expect(isGdtInvoiceCronEnabled()).toBe(false);
    });
  });

  describe('isWithinInvoiceSyncWindow', () => {
    it('returns true for times between 00:00 and 03:59 Asia/Ho_Chi_Minh (GMT+7)', () => {
      // 17:00 UTC = 00:00 VN
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-04T17:00:00.000Z')),
      ).toBe(true);

      // 18:30 UTC = 01:30 VN
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-04T18:30:00.000Z')),
      ).toBe(true);

      // 20:59 UTC = 03:59 VN
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-04T20:59:59.999Z')),
      ).toBe(true);
    });

    it('returns false for times outside 00:00 - 03:59 Asia/Ho_Chi_Minh', () => {
      // 21:00 UTC = 04:00 VN
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-04T21:00:00.000Z')),
      ).toBe(false);

      // 16:59 UTC = 23:59 VN
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-04T16:59:59.000Z')),
      ).toBe(false);

      // 05:00 UTC = 12:00 VN
      expect(
        isWithinInvoiceSyncWindow(new Date('2026-09-05T05:00:00.000Z')),
      ).toBe(false);
    });
  });
});
