import {
  FileAttachmentPurgeJob,
  MAX_BATCHES_PER_RUN,
} from './file-attachment-purge.job';

function setup(config: { autoPurgeEnabled: boolean; retentionDays: number }) {
  const settings = { get: jest.fn().mockResolvedValue(config) };
  const query = { findDueForPurge: jest.fn() };
  const purge = { purge: jest.fn() };
  const job = new FileAttachmentPurgeJob(
    settings as never,
    query as never,
    purge as never,
  );
  return { job, query, purge };
}

describe('FileAttachmentPurgeJob', () => {
  const now = new Date('2026-11-16T00:00:00Z');

  it('tắt (mặc định) thì không truy vấn, không xóa gì', async () => {
    const { job, query, purge } = setup({
      autoPurgeEnabled: false,
      retentionDays: 30,
    });
    await expect(job.run(now)).resolves.toBe(0);
    expect(query.findDueForPurge).not.toHaveBeenCalled();
    expect(purge.purge).not.toHaveBeenCalled();
  });

  it('bật thì dùng mốc now - retentionDays và chạy theo lô tới khi hết', async () => {
    const { job, query, purge } = setup({
      autoPurgeEnabled: true,
      retentionDays: 7,
    });
    query.findDueForPurge
      .mockResolvedValueOnce(['a', 'b'])
      .mockResolvedValueOnce([]);
    purge.purge.mockResolvedValue({
      purged: [{ id: 'a' }, { id: 'b' }],
      skipped: [],
    });
    await expect(job.run(now)).resolves.toBe(2);
    const cutoff: Date = query.findDueForPurge.mock.calls[0][0];
    expect(cutoff.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(purge.purge).toHaveBeenCalledWith(['a', 'b'], {
      userId: null,
      source: 'JOB',
    });
  });

  it('dừng khi một lô không xóa được dòng nào (tránh lặp vô hạn)', async () => {
    const { job, query, purge } = setup({
      autoPurgeEnabled: true,
      retentionDays: 30,
    });
    query.findDueForPurge.mockResolvedValue(['a']);
    purge.purge.mockResolvedValue({
      purged: [],
      skipped: [{ id: 'a', reason: 'STORAGE_ERROR' }],
    });
    await expect(job.run(now)).resolves.toBe(0);
    expect(purge.purge).toHaveBeenCalledTimes(1);
  });

  it('không vượt số lô tối đa mỗi lần chạy', async () => {
    const { job, query, purge } = setup({
      autoPurgeEnabled: true,
      retentionDays: 30,
    });
    query.findDueForPurge.mockResolvedValue(['a']);
    purge.purge.mockResolvedValue({ purged: [{ id: 'a' }], skipped: [] });
    await job.run(now);
    expect(purge.purge).toHaveBeenCalledTimes(MAX_BATCHES_PER_RUN);
  });
});
