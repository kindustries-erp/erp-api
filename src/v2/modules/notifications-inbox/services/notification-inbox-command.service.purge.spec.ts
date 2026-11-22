import { NotificationInboxCommandService } from './notification-inbox-command.service';

function makePurgeRepo(batches: number[]) {
  const execute = jest.fn();
  for (const affected of batches) {
    execute.mockResolvedValueOnce({ affected });
  }
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['delete', 'from', 'where']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.execute = execute;
  return {
    repo: {
      metadata: { tableName: 'notifications_inbox' },
      target: 'NotificationInbox',
      createQueryBuilder: jest.fn(() => qb),
    },
    qb,
    execute,
  };
}

describe('NotificationInboxCommandService.purgeSoftDeletedBefore', () => {
  const cutoff = new Date('2026-08-11T00:00:00Z');

  it('xóa theo lô và dừng khi lô cuối nhỏ hơn batchSize', async () => {
    const { repo, qb } = makePurgeRepo([1000, 1000, 250]);
    const service = new NotificationInboxCommandService(repo as any);

    await expect(service.purgeSoftDeletedBefore(cutoff, 1000)).resolves.toBe(
      2250,
    );
    expect(qb.execute).toHaveBeenCalledTimes(3);
  });

  it('chỉ chọn dòng đã xóa mềm và cũ hơn cutoff, lấy tên bảng từ metadata', async () => {
    const { repo, qb } = makePurgeRepo([0]);
    const service = new NotificationInboxCommandService(repo as any);

    await service.purgeSoftDeletedBefore(cutoff);

    expect(qb.from).toHaveBeenCalledWith('NotificationInbox');
    expect(qb.where).toHaveBeenCalledWith(
      expect.stringContaining('FROM "notifications_inbox"'),
      { cutoff, limit: 1000 },
    );
    expect(qb.where.mock.calls[0][0]).toContain('is_deleted = true');
    expect(qb.where.mock.calls[0][0]).toContain('updated_at < :cutoff');
  });

  it('không có dòng nào thì trả 0', async () => {
    const { repo } = makePurgeRepo([0]);
    const service = new NotificationInboxCommandService(repo as any);

    await expect(service.purgeSoftDeletedBefore(cutoff)).resolves.toBe(0);
  });
});
