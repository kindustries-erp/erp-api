import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { TablePreferencesService } from '../table-preferences.service';
import { TablePreferenceController } from './table-preference.controller';

describe('TablePreferenceController HTTP routes', () => {
  let app: INestApplication;
  let authenticated = true;
  const service = { list: jest.fn(), update: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TablePreferenceController],
      providers: [{ provide: TablePreferencesService, useValue: service }],
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
    service.list.mockResolvedValue({ items: [] });
    service.update.mockResolvedValue({ tableId: 't', columns: {}, views: {} });
  });

  it('GET /api/v2/table-preferences dùng userId từ token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v2/table-preferences?tableIdPrefix=procurement-')
      .expect(200);

    expect(res.body).toEqual({ items: [] });
    expect(service.list).toHaveBeenCalledWith('user-from-token', {
      tableIdPrefix: 'procurement-',
    });
  });

  it('PATCH /api/v2/table-preferences/:tableId bỏ qua userId gửi từ client', async () => {
    await request(app.getHttpServer())
      .patch('/api/v2/table-preferences/procurement-requests-garage-table')
      .send({ userId: 'attacker', columns: { order: ['a'] } })
      .expect(200);

    expect(service.update).toHaveBeenCalledWith(
      'user-from-token',
      'procurement-requests-garage-table',
      { columns: { order: ['a'] } },
    );
  });

  it('trả 401 khi không có token hợp lệ', async () => {
    authenticated = false;
    await request(app.getHttpServer())
      .get('/api/v2/table-preferences')
      .expect(401);
  });
});
