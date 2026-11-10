import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { GarageDashboardController } from './garage-dashboard.controller';
import { GarageDashboardService } from './garage-dashboard.service';
import { GarageOpexService } from './services/garage-opex.service';

const PATH = '/greenway/dashboard/checkpoint-cases';

describe('GarageDashboardController — checkpoint-cases', () => {
  let app: INestApplication;
  let dashboardService: { getCheckpointCases: jest.Mock };

  beforeAll(async () => {
    dashboardService = {
      getCheckpointCases: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [GarageDashboardController],
      providers: [
        { provide: GarageDashboardService, useValue: dashboardService },
        { provide: GarageOpexService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    // Cùng cấu hình với src/main.ts
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
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('thiếu date_from → 400, không gọi service', async () => {
    await request(app.getHttpServer())
      .get(PATH)
      .query({ date_to: '2026-12-31' })
      .expect(400);
    expect(dashboardService.getCheckpointCases).not.toHaveBeenCalled();
  });

  it('thiếu cả hai ngày → 400', async () => {
    await request(app.getHttpServer()).get(PATH).expect(400);
    expect(dashboardService.getCheckpointCases).not.toHaveBeenCalled();
  });

  it('payment_status ngoài danh sách → 400', async () => {
    await request(app.getHttpServer())
      .get(PATH)
      .query({
        date_from: '2026-01-01',
        date_to: '2026-12-31',
        payment_status: 'hack',
      })
      .expect(400);
    expect(dashboardService.getCheckpointCases).not.toHaveBeenCalled();
  });

  it('tham số hợp lệ → 200, service nhận đúng đối số và mặc định', async () => {
    await request(app.getHttpServer())
      .get(PATH)
      .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
      .expect(200);

    expect(dashboardService.getCheckpointCases).toHaveBeenCalledWith(
      '2026-01-01',
      '2026-12-31',
      1, // page mặc định
      20, // pageSize mặc định
      undefined, // search
      undefined, // payment_status
      undefined, // classification
      'ngayHoanThanhCongViec', // sort_by mặc định
      'DESC', // sort_order mặc định
    );
  });

  it('page/pageSize dạng chuỗi số được chuyển thành số', async () => {
    await request(app.getHttpServer())
      .get(PATH)
      .query({
        date_from: '2026-01-01',
        date_to: '2026-12-31',
        page: '2',
        pageSize: '50',
        payment_status: 'unpaid',
        sort_order: 'ASC',
      })
      .expect(200);

    expect(dashboardService.getCheckpointCases).toHaveBeenCalledWith(
      '2026-01-01',
      '2026-12-31',
      2,
      50,
      undefined,
      'unpaid',
      undefined,
      'ngayHoanThanhCongViec',
      'ASC',
    );
  });
});
