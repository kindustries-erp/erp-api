import { Logger } from '@nestjs/common';

/**
 * Các mốc giờ đồng bộ chuẩn hóa trong ngày (Múi giờ Asia/Ho_Chi_Minh, GMT+7)
 * 03:15 (Đêm/rạng sáng - tránh DB backup 00h-03h), 09:15 (Sáng), 15:15 (Chiều)
 */
export const SYNC_HOURS = [3, 9, 15] as const;
export const SYNC_MINUTE = 15;

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
 * - By default, invoice cron is enabled in production unless explicitly disabled via ENABLE_INVOICE_CRON=false.
 */
export function isInvoiceCronEnabled(): boolean {
  if (!isCronEnabled()) {
    return false;
  }
  return process.env.ENABLE_INVOICE_CRON !== 'false';
}

/**
 * Helper to determine if GDT invoice auto-sync cron should run.
 * Enabled by default when global cron is enabled, unless explicitly disabled.
 */
export function isGdtInvoiceCronEnabled(): boolean {
  if (!isCronEnabled()) {
    return false;
  }
  return process.env.ENABLE_INVOICE_CRON !== 'false';
}

/**
 * Trích xuất ngày giờ theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getVnDateTimeParts(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string, fallback = '0') =>
    parts.find((p) => p.type === type)?.value || fallback;

  return {
    year: getPart('year', '2026'),
    month: getPart('month', '01'),
    day: getPart('day', '01'),
    hour: parseInt(getPart('hour'), 10),
    minute: parseInt(getPart('minute'), 10),
    second: parseInt(getPart('second'), 10),
  };
}

/**
 * Kiểm tra thời gian hiện tại có nằm trong cửa sổ đồng bộ cho phép hay không:
 * 03:15 - 03:59, 09:15 - 09:59, 15:15 - 15:59 (Asia/Ho_Chi_Minh timezone, GMT+7)
 */
export function isWithinSyncWindow(date: Date = new Date()): boolean {
  const { hour, minute } = getVnDateTimeParts(date);
  const isValidHour = (SYNC_HOURS as readonly number[]).includes(hour);
  return isValidHour && minute >= SYNC_MINUTE;
}

/** Alias tương thích ngược */
export const isWithinInvoiceSyncWindow = isWithinSyncWindow;

/**
 * Sinh key định danh slot duy nhất trong ngày theo định dạng YYYY-MM-DD_HH15
 */
export function getSyncSlotKey(date: Date = new Date()): {
  key: string;
  hour: number;
  minute: number;
  label: string;
} {
  const { year, month, day, hour, minute } = getVnDateTimeParts(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const label = `${pad(hour)}:${pad(minute >= SYNC_MINUTE ? SYNC_MINUTE : 0)}`;

  return {
    key: `${year}-${month}-${day}_${pad(hour)}${pad(SYNC_MINUTE)}`,
    hour,
    minute,
    label,
  };
}

/**
 * Lấy mốc giờ tiếp theo trong ngày (03:15, 09:15, 15:15 Asia/Ho_Chi_Minh)
 */
export function getNextSyncSlot(date: Date = new Date()): {
  nextSlotDate: Date;
  slotHour: number;
  slotMinute: number;
  slotLabel: string;
} {
  const {
    hour: currentHour,
    minute: currentMinute,
    second: currentSecond,
  } = getVnDateTimeParts(date);

  const slotEntries = SYNC_HOURS.map((h) => ({
    hour: h,
    minute: SYNC_MINUTE,
  }));

  let target = slotEntries.find((s) => {
    if (s.hour > currentHour) return true;
    if (s.hour === currentHour) {
      if (currentMinute < s.minute) return true;
      if (currentMinute === s.minute && currentSecond === 0) return true;
    }
    return false;
  });

  let daysToAdd = 0;
  if (!target) {
    // Qua 15:15 -> slot tiếp theo là 03:15 sáng hôm sau
    target = slotEntries[0];
    daysToAdd = 1;
  }

  const targetDate = new Date(date);
  if (daysToAdd > 0) {
    targetDate.setDate(targetDate.getDate() + daysToAdd);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const slotLabel = `${pad(target.hour)}:${pad(target.minute)}`;

  return {
    nextSlotDate: targetDate,
    slotHour: target.hour,
    slotMinute: target.minute,
    slotLabel,
  };
}

/** Alias tương thích ngược */
export const getNextInvoiceSyncSlot = getNextSyncSlot;

/**
 * Kiểm tra xem một đối tượng lỗi có phải là lỗi xác thực (Auth Error / Sai mật khẩu / 401 / 403) hay không
 */
export function isAuthError(error: any): boolean {
  if (!error) return false;

  const status = error?.status || error?.statusCode || error?.response?.status;
  if (status === 401 || status === 403) {
    return true;
  }

  const errorName = (error?.name || '').toLowerCase();
  if (errorName.includes('unauthorized') || errorName.includes('forbidden')) {
    return true;
  }

  const errMsg = (
    (error?.message || '') +
    ' ' +
    JSON.stringify(error?.response?.data || '')
  ).toLowerCase();

  return (
    errMsg.includes('401') ||
    errMsg.includes('403') ||
    errMsg.includes('unauthorized') ||
    errMsg.includes('forbidden') ||
    errMsg.includes('mật khẩu') ||
    errMsg.includes('tài khoản') ||
    errMsg.includes('password') ||
    errMsg.includes('credentials') ||
    errMsg.includes('gdt_auth_failed') ||
    errMsg.includes('viettel_auth_failed')
  );
}

export interface SafeCronJobOptions<T = any> {
  jobName: string;
  logger: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, ...args: any[]) => void;
  };
  checkEnabled?: () => boolean;
  isPaused?: () => boolean;
  execute: () => Promise<T>;
  onAuthError?: (error: any) => Promise<void> | void;
  onError?: (error: any) => Promise<void> | void;
  onSuccess?: (result: T, durationMs: number) => Promise<void> | void;
}

/**
 * Runner chuẩn hóa thực thi an toàn cho toàn bộ Cron Jobs trong hệ thống.
 * - Tự động đo lường thời gian chạy
 * - Bắt lỗi xác thực (zero-lockout guard) và gọi callback onAuthError
 * - Đảm bảo lỗi của một cron không làm crash hệ thống hay ảnh hưởng đến các cron khác
 */
export async function runSafeCronJob<T = any>(
  options: SafeCronJobOptions<T>,
): Promise<{
  executed: boolean;
  success: boolean;
  result?: T;
  durationMs?: number;
}> {
  const {
    jobName,
    logger,
    checkEnabled,
    isPaused,
    execute,
    onAuthError,
    onError,
    onSuccess,
  } = options;

  if (checkEnabled && !checkEnabled()) {
    return { executed: false, success: false };
  }

  if (isPaused && isPaused()) {
    logger.warn(`[${jobName}] Bỏ qua chu kỳ chạy do đang tạm dừng.`);
    return { executed: false, success: false };
  }

  const startTime = Date.now();
  logger.log(`[${jobName}] Bắt đầu thực thi chu kỳ Cron an toàn...`);

  try {
    const result = await execute();
    const durationMs = Date.now() - startTime;
    logger.log(`[${jobName}] Thực thi thành công trong ${durationMs}ms.`);

    if (onSuccess) {
      await onSuccess(result, durationMs);
    }

    return { executed: true, success: true, result, durationMs };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    if (isAuthError(error)) {
      logger.error(
        `[${jobName}] Phát hiện lỗi xác thực/mật khẩu (${error?.status || '401/403'}: ${error?.message}). Kích hoạt Zero-Lockout Guard.`,
      );
      if (onAuthError) {
        try {
          await onAuthError(error);
        } catch (authCallbackErr: any) {
          logger.error(
            `[${jobName}] Lỗi trong callback onAuthError: ${authCallbackErr?.message}`,
          );
        }
      }
    } else {
      logger.error(
        `[${jobName}] Thực thi thất bại sau ${durationMs}ms: ${error?.message || error}`,
        error?.stack,
      );
      if (onError) {
        try {
          await onError(error);
        } catch (errorCallbackErr: any) {
          logger.error(
            `[${jobName}] Lỗi trong callback onError: ${errorCallbackErr?.message}`,
          );
        }
      }
    }

    return { executed: true, success: false, durationMs };
  }
}
