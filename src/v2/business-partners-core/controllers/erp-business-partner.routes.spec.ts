import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { applyGlobalPrefix } from '@/common/config/global-prefix.config';
import { BusinessPartnersCoreService } from '../business-partners-core.service';
import { ErpBusinessPartnerController } from './erp-business-partner.controller';

describe('ErpBusinessPartnerController routes', () => {
  let app: INestApplication;
  const allow: CanActivate = { canActivate: () => true };
  const service = {
    findAll: jest.fn().mockResolvedValue({ items: [] }),
    getNextCode: jest.fn().mockResolvedValue({ nextCode: 'KH-0001' }),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErpBusinessPartnerController],
      providers: [{ provide: BusinessPartnersCoreService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allow)
      .overrideGuard(CoreRbacGuard)
      .useValue(allow)
      .compile();

    app = moduleRef.createNestApplication();
    applyGlobalPrefix(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the list on /api/v2/business-partners', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/business-partners')
      .expect(200);
  });

  it('keeps serving the list on /api/v1/business-partners', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/business-partners')
      .expect(200);
  });

  it('does not double-prefix the v2 route', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/api/v2/business-partners')
      .expect(404);
  });

  it.each(['/api/v1/business-partners', '/api/v2/business-partners'])(
    'routes static next-code before :id on %s',
    async (base) => {
      const res = await request(app.getHttpServer())
        .get(`${base}/next-code`)
        .expect(200);
      expect(res.body).toEqual({ nextCode: 'KH-0001' });
      expect(service.findOne).not.toHaveBeenCalled();
    },
  );
});
