import { AuthSessionCleanupJob } from './auth-session-cleanup.job';
import type { SessionTokenService } from '../services/session-token.service';

describe('AuthSessionCleanupJob', () => {
  it('xóa phiên hết hạn trước thời điểm chạy và trả số dòng', async () => {
    const purge = jest.fn().mockResolvedValue(4);
    const job = new AuthSessionCleanupJob({
      purgeExpiredBefore: purge,
    } as unknown as SessionTokenService);
    const now = new Date('2026-11-15T00:00:00Z');
    await expect(job.run(now)).resolves.toBe(4);
    expect(purge).toHaveBeenCalledWith(now);
  });

  it('khai báo tên, cron 6 trường và múi giờ VN', () => {
    const job = new AuthSessionCleanupJob({} as SessionTokenService);
    expect(job.jobName).toBe('auth-sessions-cleanup');
    expect(job.cron.split(' ')).toHaveLength(6);
    expect(job.timeZone).toBe('Asia/Ho_Chi_Minh');
  });
});
