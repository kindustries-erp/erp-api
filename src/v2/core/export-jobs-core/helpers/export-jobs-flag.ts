/**
 * Cờ chuyển giữa cơ chế job nền V2 (lõi `export-jobs-core`) và cơ chế cũ.
 * Mặc định bật. Đặt `EXPORT_JOBS_V2=false` rồi khởi động lại để quay về code cũ.
 */
export function isExportJobsV2Enabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.EXPORT_JOBS_V2?.trim().toLowerCase();
  if (raw === undefined || raw === '') return true;
  return !['false', '0', 'off', 'no'].includes(raw);
}
