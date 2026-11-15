import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ScheduledJob } from '@/v2/core/scheduler-core';
import { AuditLog } from '../entities/audit-log.entity';
import {
  AUDIT_RETENTION_BATCH,
  AuditRetentionJob,
  resolveAuditRetentionDays,
} from './audit-retention.job';

function setup(
  results: Array<[unknown, number]>,
  env: Record<string, string> = {},
) {
  const query = jest.fn();
  results.forEach((r) => query.mockResolvedValueOnce(r));
  const repository = { query } as unknown as Repository<AuditLog>;
  const config = {
    get: jest.fn((k: string) => env[k]),
  } as unknown as ConfigService;
  return { job: new AuditRetentionJob(repository, config), query };
}

describe('AuditRetentionJob', () => {
  it('là ScheduledJob lúc 02:00 giờ Việt Nam', () => {
    const { job } = setup([]);
    expect(job).toBeInstanceOf(ScheduledJob);
    expect(job.cron).toBe('0 0 2 * * *');
    expect(job.timeZone).toBe('Asia/Ho_Chi_Minh');
  });

  it('xóa theo lô 2000 cho tới khi hết và dùng AUDIT_LOG_RETENTION_DAYS', async () => {
    const { job, query } = setup(
      [
        [[], AUDIT_RETENTION_BATCH],
        [[], 5],
      ],
      { AUDIT_LOG_RETENTION_DAYS: '15' },
    );
    const total = await job.run();
    expect(total).toBe(AUDIT_RETENTION_BATCH + 5);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[0][0])).toContain('FROM audit_logs');
    expect(query.mock.calls[0][1]).toEqual([15, AUDIT_RETENTION_BATCH]);
  });

  it('bỏ qua khi ENABLE_AUDIT_LOG=false', async () => {
    const { job, query } = setup([], { ENABLE_AUDIT_LOG: 'false' });
    expect(await job.run()).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('nuốt lỗi DB và trả phần đã xóa', async () => {
    const query = jest.fn().mockRejectedValue(new Error('boom'));
    const job = new AuditRetentionJob({
      query,
    } as unknown as Repository<AuditLog>);
    await expect(job.run()).resolves.toBe(0);
  });

  it('resolveAuditRetentionDays rơi về 30 khi giá trị sai', () => {
    expect(resolveAuditRetentionDays(undefined)).toBe(30);
    expect(resolveAuditRetentionDays('abc')).toBe(30);
    expect(resolveAuditRetentionDays('-3')).toBe(30);
    expect(resolveAuditRetentionDays('7')).toBe(7);
  });
});
