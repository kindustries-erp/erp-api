import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AppModule } from '@/app.module';
import { applyGlobalPrefix } from '@/common/config/global-prefix.config';
import { ErpBranch } from '@/v2/core/branches-core/entities/erp_branch.entity';

describe('branches v2 HTTP contract', () => {
  let app: INestApplication;
  let repository: {
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  const branch = {
    id: '00000000-0000-4000-8000-000000000001',
    extraData: {},
    code: 'HCM',
    name: 'Ho Chi Minh',
    address: null,
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeAll(async () => {
    const branchesModules = (
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as any[]
    ).filter((moduleType) => {
      const controllers =
        Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleType) ?? [];
      return controllers.some(
        (controller: any) =>
          Reflect.getMetadata(PATH_METADATA, controller) === 'branches',
      );
    });
    expect(branchesModules).toHaveLength(1);
    const branchesModule = branchesModules[0];
    repository = {
      findAndCount: jest.fn(),
      create: jest.fn((data) => ({ ...branch, ...data })),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [branchesModule],
    })
      .overrideProvider(getRepositoryToken(ErpBranch))
      .useValue(repository)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
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
    jest.clearAllMocks();
    repository.findAndCount.mockResolvedValue([[branch], 1]);
    repository.save.mockResolvedValue(branch);
    repository.findOne.mockResolvedValue(branch);
    repository.update.mockResolvedValue({ affected: 1 });
    repository.delete.mockResolvedValue({ affected: 1 });
  });

  it('keeps GET route, query binding, defaults, sort and response shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/branches?page=1&pageSize=20&sort=code&search=HC')
      .expect(200);
    expect(response.body).toEqual({
      items: [
        {
          ...branch,
          createdAt: branch.createdAt.toISOString(),
          updatedAt: branch.updatedAt.toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { code: 'ASC' },
        skip: 0,
        take: 20,
        where: expect.arrayContaining([
          expect.objectContaining({ code: expect.anything() }),
        ]),
      }),
    );
    await request(app.getHttpServer()).get('/api/v1/branches').expect(200);
    expect(repository.findAndCount).toHaveBeenLastCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      }),
    );
    await request(app.getHttpServer()).get('/api/v2/branches').expect(404);
  });

  it('keeps body extras accepted but only persists the legacy fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .send({
        code: 'HCM',
        name: 'Ho Chi Minh',
        is_active: false,
        address: 'ignored',
        extra: 'ignored',
      })
      .expect(201);
    expect(repository.create).toHaveBeenCalledWith({
      code: 'HCM',
      name: 'Ho Chi Minh',
      isActive: false,
    });
    expect(response.body).toEqual({
      data: {
        ...branch,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      },
      message: 'Branch created successfully',
    });
  });

  it('keeps PATCH null data on a missing record and DELETE hard-delete response', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .patch('/api/v1/branches/not-a-uuid')
      .send({ name: 'Updated', address: 'ignored', extra: true })
      .expect(200, { data: null, message: 'Branch updated successfully' });
    expect(repository.update).toHaveBeenCalledWith('not-a-uuid', {
      code: undefined,
      name: 'Updated',
      isActive: undefined,
    });
    await request(app.getHttpServer())
      .delete('/api/v1/branches/not-a-uuid')
      .expect(200, { message: 'Branch deleted successfully' });
    expect(repository.delete).toHaveBeenCalledWith('not-a-uuid');
  });

  it('propagates a foreign-key rejection instead of returning success', async () => {
    repository.delete.mockRejectedValueOnce(new Error('foreign key violation'));
    await request(app.getHttpServer())
      .delete('/api/v1/branches/referenced')
      .expect(500);
    expect(repository.delete).toHaveBeenCalledWith('referenced');
  });
});
