import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RbacRolesController } from './controllers/rbac-roles.controller';
import { RbacRolesService } from './rbac-roles.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';

/**
 * HTTP-level: tham số id phải là UUID hợp lệ. Chuỗi khác UUID bị chặn ở controller (400),
 * không được đi xuống DB (trước đây PostgreSQL ném lỗi uuid và thành 500).
 */
const VALID_UUID = '11111111-2222-4333-8444-555555555555';

describe('RbacRolesController HTTP (UUID params)', () => {
  let app: INestApplication;
  const facade = {
    getAvailableResources: jest.fn<(...args: any[]) => Promise<any>>(
      async () => [],
    ),
    getRolePermissions: jest.fn<(...args: any[]) => Promise<any>>(
      async () => [],
    ),
    getRoleUsers: jest.fn<(...args: any[]) => Promise<any>>(async () => []),
    updateRolePermissions: jest.fn<(...args: any[]) => Promise<any>>(
      async () => ({ success: true }),
    ),
    updateRoleUsers: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      success: true,
    })),
    updateRole: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      id: VALID_UUID,
    })),
    deleteRole: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      success: true,
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RbacRolesController],
      providers: [{ provide: RbacRolesService, useValue: facade }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const invalidId = 'not-a-uuid';

  it.each([
    ['GET', `/api/v2/rbac-roles/${invalidId}/permissions`],
    ['PATCH', `/api/v2/rbac-roles/${invalidId}/permissions`],
    ['GET', `/api/v2/rbac-roles/${invalidId}/users`],
    ['PATCH', `/api/v2/rbac-roles/${invalidId}/users`],
    ['PATCH', `/api/v2/rbac-roles/${invalidId}`],
    ['DELETE', `/api/v2/rbac-roles/${invalidId}`],
  ])('%s %s → 400 và không gọi facade', async (method, url) => {
    const req =
      method === 'GET'
        ? request(app.getHttpServer()).get(url)
        : method === 'PATCH'
          ? request(app.getHttpServer()).patch(url).send({})
          : request(app.getHttpServer()).delete(url);
    const res = await req;
    expect(res.status).toBe(400);
    expect(Object.values(facade).some((fn) => fn.mock.calls.length > 0)).toBe(
      false,
    );
  });

  it('GET :roleId/permissions với UUID hợp lệ → 200 { permissions: [] }', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v2/rbac-roles/${VALID_UUID}/permissions`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ permissions: [] });
    expect(facade.getRolePermissions).toHaveBeenCalledWith(VALID_UUID);
  });

  it('GET :roleId/users với UUID hợp lệ → 200 { users: [] }', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v2/rbac-roles/${VALID_UUID}/users`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [] });
  });

  it('GET /collections không bị :id nuốt → 200 { resources }', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v2/rbac-roles/collections',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ resources: [] });
  });
});
