import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import type { UserRequest } from '../helpers/audit-context';
import type { UsersManagementService } from '../users-management.service';
import { UsersManagementController } from './users-management.controller';

describe('UsersManagementController', () => {
  const service = {
    findAll: jest.fn(),
    findColumnOptions: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    deactivate: jest.fn(),
    resetPassword: jest.fn(),
    linkEmployee: jest.fn(),
    unlinkEmployee: jest.fn(),
  };
  const controller = new UsersManagementController(
    service as unknown as UsersManagementService,
  );
  const request = {
    user: { sub: 'admin-1', email: 'admin@liouni.com' },
    headers: {},
  } as unknown as UserRequest;

  beforeEach(() => jest.clearAllMocks());

  it('yêu cầu quyền admin_users:manage ở cấp controller', () => {
    expect(
      Reflect.getMetadata(RBAC_PERMISSIONS_KEY, UsersManagementController),
    ).toEqual([
      { resource: ErpResource.ADMIN_USERS, action: ErpAction.MANAGE },
    ]);
  });

  it('route là api/v2/users-management (một chuỗi, không alias v1)', () => {
    expect(Reflect.getMetadata('path', UsersManagementController)).toBe(
      'api/v2/users-management',
    );
  });

  it('column-options khai báo trước :id', () => {
    const names = Object.getOwnPropertyNames(
      UsersManagementController.prototype,
    );
    expect(names.indexOf('columnOptions')).toBeLessThan(
      names.indexOf('findOne'),
    );
  });

  it('chuyển query xuống facade', async () => {
    const query = {} as never;
    await controller.findAll(query);
    await controller.columnOptions(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(service.findColumnOptions).toHaveBeenCalledWith(query);
  });

  it('mutation truyền ngữ cảnh audit có actor từ JWT', async () => {
    await controller.activate('u1', request);
    await controller.deactivate('u1', request);
    await controller.unlinkEmployee('u1', request);
    for (const fn of [
      service.activate,
      service.deactivate,
      service.unlinkEmployee,
    ]) {
      expect(fn).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          actorUserId: 'admin-1',
          actorEmail: 'admin@liouni.com',
        }),
      );
    }
  });

  it('create, update, reset, link truyền DTO kèm ngữ cảnh', async () => {
    const dto = {} as never;
    await controller.create(dto, request);
    await controller.update('u1', dto, request);
    await controller.resetPassword('u1', dto, request);
    await controller.linkEmployee('u1', dto, request);
    expect(service.create).toHaveBeenCalledWith(dto, expect.anything());
    expect(service.update).toHaveBeenCalledWith('u1', dto, expect.anything());
    expect(service.resetPassword).toHaveBeenCalledWith(
      'u1',
      dto,
      expect.anything(),
    );
    expect(service.linkEmployee).toHaveBeenCalledWith(
      'u1',
      dto,
      expect.anything(),
    );
  });
});
