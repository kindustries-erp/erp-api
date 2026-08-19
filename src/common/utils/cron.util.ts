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
