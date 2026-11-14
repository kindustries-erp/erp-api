import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { InventoryMovementsGarageVouchersController } from './controllers/inventory-movements-garage-vouchers.controller';
import { InventoryMovementsGarageVouchersService } from './inventory-movements-garage-vouchers.service';

async function boot(allow: boolean, facade: object) {
  const moduleRef = await Test.createTestingModule({
    controllers: [InventoryMovementsGarageVouchersController],
    providers: [
      { provide: InventoryMovementsGarageVouchersService, useValue: facade },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(CoreRbacGuard)
    .useValue({ canActivate: () => allow })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('GET /api/v2/inventory-movements-garage-vouchers', () => {
  const pagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const facade = {
    list: jest.fn(async () => ({
      items: [],
      pagination,
      summaries: { totalAmount: null },
      extraData: { typeCounts: { ISSUE: 2 } },
    })),
    columnOptions: jest.fn(async () => ({ items: [], pagination })),
  };
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  it('returns the unified list and transforms query types', async () => {
    app = await boot(true, facade);
    const res = await request(app.getHttpServer())
      .get('/api/v2/inventory-movements-garage-vouchers')
      .query({
        page: '2',
        pageSize: '5',
        type: 'ISSUE',
        dateFrom: '2026-01-01',
      })
      .expect(200);
    expect(res.body.items).toEqual([]);
    // Hợp đồng list v2: summaries và extraData đi nguyên qua controller
    expect(res.body.summaries).toEqual({ totalAmount: null });
    expect(res.body.extraData).toEqual({ typeCounts: { ISSUE: 2 } });
    expect(facade.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 5, type: 'ISSUE' }),
    );
  });

  it('rejects malformed dates and unknown params', async () => {
    app = await boot(true, facade);
    const url = '/api/v2/inventory-movements-garage-vouchers';
    await request(app.getHttpServer())
      .get(url)
      .query({ dateFrom: 'x' })
      .expect(400);
    await request(app.getHttpServer()).get(url).query({ foo: '1' }).expect(400);
  });

  it('serves column-options before any id route', async () => {
    app = await boot(true, facade);
    await request(app.getHttpServer())
      .get('/api/v2/inventory-movements-garage-vouchers/column-options')
      .query({ column: 'status' })
      .expect(200);
    expect(facade.columnOptions).toHaveBeenCalled();
  });

  it('returns 403 without permission', async () => {
    app = await boot(false, facade);
    await request(app.getHttpServer())
      .get('/api/v2/inventory-movements-garage-vouchers')
      .expect(403);
    expect(facade.list).not.toHaveBeenCalled();
  });
});
