import { NotificationInboxQueryService } from './notification-inbox-query.service';

function makeQb(result: { items?: unknown[]; total?: number; count?: number }) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getManyAndCount = jest
    .fn()
    .mockResolvedValue([result.items ?? [], result.total ?? 0]);
  qb.getCount = jest.fn().mockResolvedValue(result.count ?? 0);
  return qb;
}

describe('NotificationInboxQueryService', () => {
  it('luôn lọc theo userId và isDeleted, không nhận userId khác', async () => {
    const qb = makeQb({ total: 0 });
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new NotificationInboxQueryService(repo as any);

    await service.listForUser('user-a', { page: 1, pageSize: 20 });

    expect(qb.where).toHaveBeenCalledWith('n.userId = :userId', {
      userId: 'user-a',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('n.isDeleted = :isDeleted', {
      isDeleted: false,
    });
  });

  it('phân trang: skip = (page-1)*pageSize, take = pageSize', async () => {
    const qb = makeQb({ total: 45 });
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new NotificationInboxQueryService(repo as any);

    const res = await service.listForUser('u', { page: 3, pageSize: 20 });

    expect(qb.skip).toHaveBeenCalledWith(40);
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(res.total).toBe(45);
  });

  it('unreadOnly và type thêm điều kiện lọc', async () => {
    const qb = makeQb({ total: 0 });
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new NotificationInboxQueryService(repo as any);

    await service.listForUser('u', {
      page: 1,
      pageSize: 10,
      unreadOnly: true,
      type: 'ERROR',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('n.isRead = :isRead', {
      isRead: false,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('n.type = :type', {
      type: 'ERROR',
    });
  });

  it('countUnread đếm chưa đọc của đúng user', async () => {
    const qb = makeQb({ count: 3 });
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new NotificationInboxQueryService(repo as any);

    await expect(service.countUnread('u')).resolves.toBe(3);
    expect(qb.where).toHaveBeenCalledWith('n.userId = :userId', {
      userId: 'u',
    });
  });
});
