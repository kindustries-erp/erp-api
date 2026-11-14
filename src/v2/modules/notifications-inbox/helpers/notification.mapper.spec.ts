import {
  toNotificationResponse,
  toPaginationMeta,
} from './notification.mapper';

describe('notification.mapper', () => {
  it('map entity sang response, readAt null giữ nguyên', () => {
    const res = toNotificationResponse({
      id: 'n1',
      title: 'T',
      message: 'M',
      type: 'WARNING',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-11-09T00:00:00Z'),
      extraData: { i18nTitleKey: 'a.b' },
    } as any);

    expect(res).toEqual({
      id: 'n1',
      title: 'T',
      message: 'M',
      type: 'WARNING',
      isRead: false,
      readAt: null,
      createdAt: '2026-11-09T00:00:00.000Z',
      extraData: { i18nTitleKey: 'a.b' },
      target: null,
    });
  });

  it('map target khi có chứng từ liên quan', () => {
    const res = toNotificationResponse({
      id: 'n2',
      title: 'T',
      message: 'M',
      type: 'WARNING',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-11-09T00:00:00Z'),
      extraData: {},
      targetModule: 'PROCUREMENT_ORDER_GARAGE',
      targetId: 'PO-0001',
      action: 'APPROVE',
    } as any);

    expect(res.target).toEqual({
      module: 'PROCUREMENT_ORDER_GARAGE',
      id: 'PO-0001',
      action: 'APPROVE',
    });
  });

  it('không trả các trường ngoài response (isDeleted, userId)', () => {
    const res = toNotificationResponse({
      id: 'n1',
      title: 'T',
      message: 'M',
      type: 'INFO',
      isRead: true,
      readAt: new Date('2026-11-09T01:00:00Z'),
      createdAt: new Date('2026-11-09T00:00:00Z'),
      extraData: undefined,
      userId: 'secret',
      isDeleted: false,
    } as any);

    expect(res).not.toHaveProperty('userId');
    expect(res).not.toHaveProperty('isDeleted');
    expect(res.extraData).toEqual({});
  });

  it('toPaginationMeta: totalPages tối thiểu 1', () => {
    expect(toPaginationMeta(1, 20, 0).totalPages).toBe(1);
    expect(toPaginationMeta(1, 20, 45).totalPages).toBe(3);
    expect(toPaginationMeta(1, 20, 45)).toMatchObject({
      next: 2,
      previous: null,
    });
  });
});
