import { NotificationsV2Service } from './notifications.service';

describe('NotificationsV2Service (facade)', () => {
  const row = {
    id: 'n1',
    title: 'T',
    message: 'M',
    type: 'INFO',
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-11-09T00:00:00Z'),
    extraData: {},
  };

  function setup() {
    const query = {
      listForUser: jest.fn().mockResolvedValue({ items: [row], total: 41 }),
      countUnread: jest.fn().mockResolvedValue(5),
    };
    const command = {
      markRead: jest.fn().mockResolvedValue(undefined),
      markAllRead: jest.fn().mockResolvedValue(3),
      softDelete: jest.fn().mockResolvedValue(undefined),
      softDeleteAll: jest.fn().mockResolvedValue(2),
    };
    return {
      service: new NotificationsV2Service(query as any, command as any),
      query,
      command,
    };
  }

  it('list trả items là response DTO, pagination và unreadCount', async () => {
    const { service, query } = setup();

    const res = await service.list('user-a', { page: 2, pageSize: 20 } as any);

    expect(query.listForUser).toHaveBeenCalledWith('user-a', {
      page: 2,
      pageSize: 20,
      unreadOnly: undefined,
      type: undefined,
    });
    expect(res.items[0]).toMatchObject({ id: 'n1', isRead: false });
    expect(res.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
    expect(res.unreadCount).toBe(5);
  });

  it('thao tác đơn trả { message, data } và dùng userId được truyền vào', async () => {
    const { service, command } = setup();

    const res = await service.markRead('n1', 'user-a');

    expect(command.markRead).toHaveBeenCalledWith('n1', 'user-a');
    expect(res).toEqual({ message: expect.any(String), data: null });
  });

  it('thao tác hàng loạt trả số dòng bị ảnh hưởng', async () => {
    const { service } = setup();

    await expect(service.markAllRead('u')).resolves.toMatchObject({
      data: { affected: 3 },
    });
    await expect(service.removeAll('u')).resolves.toMatchObject({
      data: { affected: 2 },
    });
  });

  it('không trả entity: kết quả không có userId', async () => {
    const { service } = setup();

    const res = await service.list('u', { page: 1, pageSize: 20 } as any);

    expect(res.items[0]).not.toHaveProperty('userId');
  });
});
