import { DEFAULT_JOB_TIMEZONE } from '../types/scheduler.types';

/**
 * Lớp nền cho job định kỳ (abstract, không `@Cron`). Module cụ thể kế thừa, khai báo
 * tên, lịch và `run()`. `scheduler-jobs` tự phát hiện mọi provider kế thừa lớp này
 * và đăng ký; cổng `isCronEnabled()` quyết định bật hay tắt.
 */
export abstract class ScheduledJob {
  /** Tên duy nhất trong toàn hệ thống, ví dụ `notifications-purge`. */
  abstract readonly jobName: string;
  /** Biểu thức cron 6 trường (có giây), ví dụ `0 30 2 * * *`. */
  abstract readonly cron: string;
  /** Múi giờ IANA. */
  readonly timeZone: string = DEFAULT_JOB_TIMEZONE;

  /** Nội dung một lần chạy. Lỗi được cô lập bởi scheduler, không làm sập job khác. */
  abstract run(): Promise<unknown>;
}
