import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { InventoryMovementsGarageLedgerController } from './controllers/inventory-movements-garage-ledger.controller';
import { InventoryMovementsGarageLedgerService } from './inventory-movements-garage-ledger.service';

async function boot(allow: boolean, facade: object) {
  const moduleRef = await Test.createTestingModule({
    controllers: [InventoryMovementsGarageLedgerController],
    providers: [
      { provide: InventoryMovementsGarageLedgerService, useValue: facade },
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

describe('inventory-movements-garage-ledger (read API)', () => {
  const facade = {
    listBalances: jest.fn(async () => ({
      items: [],
      summaries: {
        qtyOnHand: { total: 3, pageSubtotal: 3, cumulative: 3 },
      },
      extraData: { tabCounts: { ALL: 1, IN_STOCK: 1 } },
    })),
    listTransactions: jest.fn(async () => ({ items: [] })),
  };
  let app: INestApplication;
  const base = '/api/v2/inventory-movements-garage-ledger';

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  it('balances: transforms query and rejects client-supplied scope', async () => {
    app = await boot(true, facade);
    const res = await request(app.getHttpServer())
      .get(`${base}/balances`)
      .query({ page: '2', stockTab: 'NEGATIVE' })
      .expect(200);
    expect(facade.listBalances).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, stockTab: 'NEGATIVE' }),
    );
    // Hợp đồng list v2: summaries và extraData.tabCounts đi nguyên qua controller
    expect(res.body.summaries.qtyOnHand).toEqual({
      total: 3,
      pageSubtotal: 3,
      cumulative: 3,
    });
    expect(res.body.extraData).toEqual({ tabCounts: { ALL: 1, IN_STOCK: 1 } });
    await request(app.getHttpServer())
      .get(`${base}/balances`)
      .query({ ledgerScope: 'OTHER' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`${base}/balances`)
      .query({ stockTab: 'BAD' })
      .expect(400);
  });

  it('transactions: itemCode is required', async () => {
    app = await boot(true, facade);
    await request(app.getHttpServer()).get(`${base}/transactions`).expect(400);
    await request(app.getHttpServer())
      .get(`${base}/transactions`)
      .query({ itemCode: 'A' })
      .expect(200);
  });

  it('returns 403 without permission', async () => {
    app = await boot(false, facade);
    await request(app.getHttpServer()).get(`${base}/balances`).expect(403);
    await request(app.getHttpServer()).get(`${base}/transactions`).expect(403);
  });
});
