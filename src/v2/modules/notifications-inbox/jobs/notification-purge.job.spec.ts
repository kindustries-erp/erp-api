import {
  DEFAULT_PURGE_RETENTION_DAYS,
  NOTIFICATION_PURGE_CRON,
  NOTIFICATION_PURGE_JOB_NAME,
  NOTIFICATION_PURGE_TIMEZONE,
  NotificationPurgeJob,
  resolveRetentionDays,
} from './notification-purge.job';
import { ScheduledJob } from '@/v2/core/scheduler-core';

describe('resolveRetentionDays', () => {
  it('dùng mặc định 90 khi thiếu hoặc không hợp lệ', () => {
    expect(resolveRetentionDays(undefined)).toBe(DEFAULT_PURGE_RETENTION_DAYS);
    expect(resolveRetentionDays('')).toBe(90);
    expect(resolveRetentionDays('abc')).toBe(90);
    expect(resolveRetentionDays('0')).toBe(90);
    expect(resolveRetentionDays('-5')).toBe(90);
    expect(resolveRetentionDays('2.5')).toBe(90);
  });

  it('nhận số nguyên dương', () => {
    expect(resolveRetentionDays('30')).toBe(30);
  });
});

describe('NotificationPurgeJob', () => {
  const originalEnv = process.env.NOTIFICATION_PURGE_RETENTION_DAYS;

  afterEach(() => {
    if (originalEnv === undefined)
      delete process.env.NOTIFICATION_PURGE_RETENTION_DAYS;
    else process.env.NOTIFICATION_PURGE_RETENTION_DAYS = originalEnv;
  });

  it('kế thừa ScheduledJob với tên, lịch và múi giờ cố định', () => {
    const job = new NotificationPurgeJob({} as any);

    expect(job).toBeInstanceOf(ScheduledJob);
    expect(job.jobName).toBe(NOTIFICATION_PURGE_JOB_NAME);
    expect(job.cron).toBe(NOTIFICATION_PURGE_CRON);
    expect(job.timeZone).toBe(NOTIFICATION_PURGE_TIMEZONE);
    expect(job.cron).toBe('0 30 2 * * *');
  });

  it('xóa cứng với mốc cutoff = now - 90 ngày mặc định', async () => {
    delete process.env.NOTIFICATION_PURGE_RETENTION_DAYS;
    const command = { purgeSoftDeletedBefore: jest.fn().mockResolvedValue(7) };
    const job = new NotificationPurgeJob(command as any);
    const now = new Date('2026-11-09T00:00:00Z');

    await expect(job.run(now)).resolves.toBe(7);

    const cutoff = command.purgeSoftDeletedBefore.mock.calls[0][0] as Date;
    expect(now.getTime() - cutoff.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('đọc NOTIFICATION_PURGE_RETENTION_DAYS khi có giá trị hợp lệ', async () => {
    process.env.NOTIFICATION_PURGE_RETENTION_DAYS = '30';
    const command = { purgeSoftDeletedBefore: jest.fn().mockResolvedValue(0) };
    const job = new NotificationPurgeJob(command as any);
    const now = new Date('2026-11-09T00:00:00Z');

    await job.run(now);

    const cutoff = command.purgeSoftDeletedBefore.mock.calls[0][0] as Date;
    expect(now.getTime() - cutoff.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
