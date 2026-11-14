import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { InventoryMovementsGarageAdjustmentController } from '../inventory-movements-garage-adjustments/controllers/inventory-movements-garage-adjustment.controller';
import { InventoryMovementsGarageAdjustmentsService } from '../inventory-movements-garage-adjustments/inventory-movements-garage-adjustments.service';
import { InventoryMovementsGarageIssueController } from '../inventory-movements-garage-issues/controllers/inventory-movements-garage-issue.controller';
import { InventoryMovementsGarageIssuesService } from '../inventory-movements-garage-issues/inventory-movements-garage-issues.service';
import { InventoryMovementsGarageReceiptController } from './controllers/inventory-movements-garage-receipt.controller';
import { InventoryMovementsGarageReceiptsService } from './inventory-movements-garage-receipts.service';

const pagination = {
  page: 2,
  pageSize: 5,
  total: 11,
  totalPages: 3,
  next: 3,
  previous: 1,
};

describe.each([
  [
    'adjustments',
    InventoryMovementsGarageAdjustmentController,
    InventoryMovementsGarageAdjustmentsService,
  ],
  [
    'receipts',
    InventoryMovementsGarageReceiptController,
    InventoryMovementsGarageReceiptsService,
  ],
  [
    'issues',
    InventoryMovementsGarageIssueController,
    InventoryMovementsGarageIssuesService,
  ],
])('GET /api/v2/inventory-movements-garage-%s (list)', (name, ctrl, svc) => {
  let app: INestApplication;
  const facade = { list: jest.fn(async () => ({ items: [], pagination })) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ctrl as any],
      providers: [{ provide: svc, useValue: facade }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => facade.list.mockClear());

  it('?page=2&pageSize=5 → { items, pagination }, query được ép kiểu số', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v2/inventory-movements-garage-${name}?page=2&pageSize=5&status=POSTED`,
      )
      .expect(200);
    expect(res.body).toEqual({ items: [], pagination });
    expect(facade.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 5, status: 'POSTED' }),
    );
  });

  it('?page=0 → 400, không gọi facade', async () => {
    await request(app.getHttpServer())
      .get(`/api/v2/inventory-movements-garage-${name}?page=0`)
      .expect(400);
    expect(facade.list).not.toHaveBeenCalled();
  });
});
