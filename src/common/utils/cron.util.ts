/**
 * Helper to determine if cron jobs and background recurring loops should run.
 *
 * Rules:
 * - If ENABLE_CRON is explicitly set to 'true', cron is enabled (useful for local testing).
 * - If ENABLE_CRON is explicitly set to 'false', cron is disabled.
 * - Otherwise, cron is ONLY enabled in production environments (APP_ENV ends with '-production' or NODE_ENV === 'production').
 */
export function isCronEnabled(): boolean {
  const explicitEnable = process.env.ENABLE_CRON;
  if (explicitEnable === 'true') {
    return true;
  }
  if (explicitEnable === 'false') {
    return false;
  }

  const appEnv = process.env.APP_ENV || '';
  const nodeEnv = process.env.NODE_ENV || '';

  return appEnv.endsWith('-production') || nodeEnv === 'production';
}

/**
 * Helper to determine if invoice auto-sync cron jobs (GDT and Sinvoice) should run.
 * Rules:
 * - If global cron is disabled (!isCronEnabled()), invoice cron is disabled.
 * - By default, invoice cron is temporarily disabled unless explicitly enabled via ENABLE_INVOICE_CRON=true.
 */
export function isInvoiceCronEnabled(): boolean {
  if (!isCronEnabled()) {
    return false;
  }
  return process.env.ENABLE_INVOICE_CRON === 'true';
}

/**
 * Helper to determine if GDT invoice auto-sync cron should run.
 * Tạm khóa cứng trong code (false) theo yêu cầu để người dùng setup lại mật khẩu mới an toàn.
 */
export function isGdtInvoiceCronEnabled(): boolean {
  return false;
}

/**
 * Helper to check if current time is within allowed invoice sync window:
 * 00:00 to 03:59 (Asia/Ho_Chi_Minh timezone, GMT+7).
 */
export function isWithinInvoiceSyncWindow(date: Date = new Date()): boolean {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date);
  const hour = parseInt(hourStr, 10);
  return hour >= 0 && hour <= 3;
}
