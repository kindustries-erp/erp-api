import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { NotificationsInboxService } from '../notifications-inbox.service';
import { NotificationController } from './notification.controller';

describe('NotificationController HTTP routes', () => {
  let app: INestApplication;
  let authenticated = true;
  const service = {
    list: jest.fn(),
    unreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
    removeAll: jest.fn(),
  };
  const UUID = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationsInboxService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          if (!authenticated) throw new UnauthorizedException();
          ctx.switchToHttp().getRequest().user = { sub: 'user-from-token' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    authenticated = true;
    jest.clearAllMocks();
    service.list.mockResolvedValue({
      items: [],
      pagination: {},
      extraData: { unreadCount: 0 },
    });
    service.unreadCount.mockResolvedValue({ unreadCount: 0 });
    service.markRead.mockResolvedValue({ message: 'ok', data: null });
    service.markAllRead.mockResolvedValue({
      message: 'ok',
      data: { affected: 0 },
    });
    service.remove.mockResolvedValue({ message: 'ok', data: null });
    service.removeAll.mockResolvedValue({
      message: 'ok',
      data: { affected: 0 },
    });
  });

  it('GET /api/v2/notifications-inbox dùng userId từ token, không nhận từ query', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v2/notifications-inbox?userId=other&unreadOnly=true&pageSize=10',
      )
      .expect(200);

    expect(service.list).toHaveBeenCalledWith(
      'user-from-token',
      expect.objectContaining({ unreadOnly: true, pageSize: 10 }),
    );
  });

  it('GET unread-count và PATCH read-all đi đúng route tĩnh', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/notifications-inbox/unread-count')
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/v2/notifications-inbox/read-all')
      .expect(200);

    expect(service.unreadCount).toHaveBeenCalledWith('user-from-token');
    expect(service.markAllRead).toHaveBeenCalledWith('user-from-token');
  });

  it('DELETE /all không bị bắt bởi route :id (không trả 400)', async () => {
    await request(app.getHttpServer())
      .delete('/api/v2/notifications-inbox/all')
      .expect(200);

    expect(service.removeAll).toHaveBeenCalledWith('user-from-token');
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('PATCH :id/read và DELETE :id truyền id hợp lệ và userId từ token', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v2/notifications-inbox/${UUID}/read`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v2/notifications-inbox/${UUID}`)
      .expect(200);

    expect(service.markRead).toHaveBeenCalledWith(UUID, 'user-from-token');
    expect(service.remove).toHaveBeenCalledWith(UUID, 'user-from-token');
  });

  it('id không phải UUID ⇒ 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v2/notifications-inbox/abc/read')
      .expect(400);
    expect(service.markRead).not.toHaveBeenCalled();
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    authenticated = false;
    await request(app.getHttpServer())
      .get('/api/v2/notifications-inbox')
      .expect(401);
  });
});
