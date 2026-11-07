import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { applyGlobalPrefix } from '@/common/config/global-prefix.config';
import { BranchesManagementService } from '../branches-management.service';
import { ErpBranchController } from './erp-branch.controller';

describe('ErpBranchController HTTP routes', () => {
  let app: INestApplication;
  let allowed = true;
  const row = {
    id: 'id-1',
    code: 'HN',
    name: 'Ha Noi',
    address: null,
    isActive: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErpBranchController],
      providers: [{ provide: BranchesManagementService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => {
          if (!allowed) throw new UnauthorizedException();
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    applyGlobalPrefix(app);
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
    allowed = true;
    jest.clearAllMocks();
    service.findAll.mockResolvedValue({
      items: [row],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    service.create.mockResolvedValue({
      data: row,
      message: 'Branch created successfully',
    });
    service.update.mockResolvedValue({
      data: null,
      message: 'Branch updated successfully',
    });
    service.remove.mockResolvedValue({
      message: 'Branch deleted successfully',
    });
  });

  it('keeps list path and validated pagination DTO', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/branches?page=2&pageSize=5&sort=code')
      .expect(200, {
        items: [row],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 5,
        sort: 'code',
      }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/branches?page=0')
      .expect(400);
    await request(app.getHttpServer()).get('/api/v2/branches').expect(404);
    await request(app.getHttpServer()).get('/api/v1/branches/id-1').expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/branches/column-options')
      .expect(404);
  });

  it('accepts unknown body keys on POST and PATCH but drops them before the facade', async () => {
    const body = {
      code: 'HN',
      name: 'Ha Noi',
      is_active: false,
      address: 'ignored',
      extra: 1,
    };
    const accepted = { code: 'HN', name: 'Ha Noi', is_active: false };
    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send(body)
      .expect(201, { data: row, message: 'Branch created successfully' });
    await request(app.getHttpServer())
      .patch('/api/v1/branches/not-a-uuid')
      .send(body)
      .expect(200, { data: null, message: 'Branch updated successfully' });
    expect(service.create).toHaveBeenCalledWith(accepted);
    expect(service.update).toHaveBeenCalledWith('not-a-uuid', accepted);
  });

  it('accepts the exact UI payload shape and an empty PATCH body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send({ code: 'HN', name: 'Ha Noi' })
      .expect(201);
    await request(app.getHttpServer())
      .patch('/api/v1/branches/id-1')
      .send({})
      .expect(200);
    expect(service.create).toHaveBeenLastCalledWith({
      code: 'HN',
      name: 'Ha Noi',
    });
    expect(service.update).toHaveBeenLastCalledWith('id-1', {});
  });

  it('rejects wrong-typed or missing fields with 400 before reaching the facade', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send({ code: 'HN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send({ code: 'HN', name: 'Ha Noi', is_active: 'abc' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send({ code: 'x'.repeat(101), name: 'Ha Noi' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/v1/branches/id-1')
      .send({ name: null })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('keeps hard DELETE and JWT-only protection on every route', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/branches/not-a-uuid')
      .expect(200, { message: 'Branch deleted successfully' });
    allowed = false;
    await request(app.getHttpServer()).get('/api/v1/branches').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/v1/branches/id-1')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .delete('/api/v1/branches/id-1')
      .expect(401);
  });
});
