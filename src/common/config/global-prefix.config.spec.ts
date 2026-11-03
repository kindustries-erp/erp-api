import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  GLOBAL_PREFIX,
  GLOBAL_PREFIX_EXCLUDE,
  applyGlobalPrefix,
} from './global-prefix.config';

@Controller('ping')
class PingV1Controller {
  @Get()
  ping() {
    return { ok: 'v1' };
  }
}

@Controller('api/v2/ping')
class PingV2Controller {
  @Get()
  ping() {
    return { ok: 'v2' };
  }
}

describe('global prefix config', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PingV1Controller, PingV2Controller],
    }).compile();

    app = moduleRef.createNestApplication();
    applyGlobalPrefix(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the v1 prefix', () => {
    expect(GLOBAL_PREFIX).toBe('api/v1');
  });

  it('serves v1 routes under /api/v1', async () => {
    await request(app.getHttpServer()).get('/api/v1/ping').expect(200);
  });

  it('does not serve v1 routes without the prefix', async () => {
    await request(app.getHttpServer()).get('/ping').expect(404);
  });

  it('serves v2 routes under /api/v2 without the v1 prefix', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v2/ping')
      .expect(200);
    expect(res.body).toEqual({ ok: 'v2' });
  });

  it('does not double-prefix v2 routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/api/v2/ping').expect(404);
  });

  it('excludes only api/v2 paths', () => {
    expect(GLOBAL_PREFIX_EXCLUDE).toEqual([
      expect.objectContaining({ path: 'api/v2/*path' }),
    ]);
  });
});
