/** Khai báo một job định kỳ được đăng ký vào scheduler-core. */
export interface ScheduledJobDefinition {
  /** Tên duy nhất trong toàn hệ thống, ví dụ `notifications-purge`. */
  name: string;
  /** Biểu thức cron 6 trường (có giây), ví dụ `0 30 2 * * *`. */
  cron: string;
  /** Múi giờ IANA. Mặc định `Asia/Ho_Chi_Minh`. */
  timeZone?: string;
  /** Nội dung job. Lỗi được cô lập qua runSafeCronJob, không làm sập job khác. */
  execute: () => Promise<unknown>;
}

/** Trạng thái đo trong bộ nhớ của một job, reset khi process khởi động lại. */
export interface JobStatus {
  name: string;
  cron: string;
  timeZone: string;
  /** Cổng `isCronEnabled()` tại thời điểm bootstrap. */
  enabled: boolean;
  /** Job đang chạy ở chu kỳ hiện tại. */
  running: boolean;
  lastRunAt: Date | null;
  lastSuccess: boolean | null;
  lastDurationMs: number | null;
}

export const DEFAULT_JOB_TIMEZONE = 'Asia/Ho_Chi_Minh';
