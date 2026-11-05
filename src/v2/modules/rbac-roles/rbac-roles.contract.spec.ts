import { describe, expect, it, jest } from '@jest/globals';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { RbacRolesController } from './controllers/rbac-roles.controller';
import { RbacRolesService } from './rbac-roles.service';
import { RoleQueryService } from './services/role-query.service';
import { RoleCommandService } from './services/role-command.service';
import { RolePermissionsService } from './services/role-permissions.service';
import { RoleUsersService } from './services/role-users.service';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac';

/**
 * Hợp đồng API /api/v1/rbac-core sau migrate v2.
 * Cùng bộ kiểm với bản baseline v1; khác biệt duy nhất có chủ đích: users chỉ có {id, email}.
 */

const ROUTES: Array<{
  method: keyof RbacRolesController;
  http: RequestMethod;
  path: string;
}> = [
  {
    method: 'getRolesColumnOptions',
    http: RequestMethod.GET,
    path: 'roles/column-options',
  },
  { method: 'getRoles', http: RequestMethod.GET, path: 'roles' },
  { method: 'createRole', http: RequestMethod.POST, path: 'roles' },
  { method: 'getRole', http: RequestMethod.GET, path: 'roles/:id' },
  { method: 'updateRole', http: RequestMethod.PATCH, path: 'roles/:id' },
  { method: 'deleteRole', http: RequestMethod.DELETE, path: 'roles/:id' },
  {
    method: 'getRolePermissions',
    http: RequestMethod.GET,
    path: 'roles/:roleId/permissions',
  },
  {
    method: 'updateRolePermissions',
    http: RequestMethod.PATCH,
    path: 'roles/:roleId/permissions',
  },
  {
    method: 'getRoleUsers',
    http: RequestMethod.GET,
    path: 'roles/:roleId/users',
  },
  {
    method: 'updateRoleUsers',
    http: RequestMethod.PATCH,
    path: 'roles/:roleId/users',
  },
  {
    method: 'getAvailableResources',
    http: RequestMethod.GET,
    path: 'collections',
  },
];

const ADMIN_MANAGE = [
  { resource: ErpResource.ADMIN_USERS, action: ErpAction.MANAGE },
];

/** Query builder giả: mọi hàm trả về chính nó; getManyAndCount trả [items, total]. */
const chainableQb = (result: [unknown[], number]) => {
  const qb: any = {};
  for (const fn of [
    'leftJoinAndSelect',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'where',
  ]) {
    qb[fn] = jest.fn(() => qb);
  }
  qb.getManyAndCount = jest.fn(async () => result);
  return qb;
};

const makeFacade = () => {
  const roleRepository: any = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x: unknown) => x),
    remove: jest.fn(),
  };
  const permissionRepository: any = {
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(),
  };
  const userRoleRepository: any = {
    find: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(),
  };
  const facade = new RbacRolesService(
    new RoleQueryService(roleRepository),
    new RoleCommandService(roleRepository),
    new RolePermissionsService(permissionRepository),
    new RoleUsersService(userRoleRepository),
  );
  return { facade, roleRepository, permissionRepository, userRoleRepository };
};

describe('RBAC Roles API contract (v2)', () => {
  describe('routes và RBAC', () => {
    it.each(ROUTES)(
      '$method → $http $path (RequirePermissions ADMIN_USERS/MANAGE)',
      ({ method, http, path }) => {
        const handler = RbacRolesController.prototype[method] as object;
        expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
        expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(http);
        expect(Reflect.getMetadata(RBAC_PERMISSIONS_KEY, handler)).toEqual(
          ADMIN_MANAGE,
        );
      },
    );

    it('controller gốc là rbac-core và bảo vệ bằng JwtAuthGuard + CoreRbacGuard', () => {
      expect(Reflect.getMetadata(PATH_METADATA, RbacRolesController)).toBe(
        'rbac-core',
      );
      const guards =
        Reflect.getMetadata('__guards__', RbacRolesController) ?? [];
      expect(guards.map((g: any) => g.name)).toEqual(
        expect.arrayContaining(['JwtAuthGuard', 'CoreRbacGuard']),
      );
    });
  });

  describe('controller bọc envelope (facade stub)', () => {
    const stub = () =>
      ({
        getRolePermissions: jest.fn(async () => [{ resource: 'x' }]),
        getRoleUsers: jest.fn(async () => [{ id: 'u1', email: 'a@b.c' }]),
        getAvailableResources: jest.fn(async () => [
          { resource: '*', label: 'All' },
        ]),
        updateRolePermissions: jest.fn(async () => ({ success: true })),
        updateRoleUsers: jest.fn(async () => ({ success: true })),
        deleteRole: jest.fn(async () => ({ success: true })),
      }) as any;

    it('GET roles/:roleId/permissions → { permissions }', async () => {
      await expect(
        new RbacRolesController(stub()).getRolePermissions('r1'),
      ).resolves.toEqual({
        permissions: [{ resource: 'x' }],
      });
    });

    it('GET roles/:roleId/users → { users: [{id, email}] }', async () => {
      await expect(
        new RbacRolesController(stub()).getRoleUsers('r1'),
      ).resolves.toEqual({
        users: [{ id: 'u1', email: 'a@b.c' }],
      });
    });

    it('GET collections → { resources }', async () => {
      await expect(
        new RbacRolesController(stub()).getAvailableResources(),
      ).resolves.toEqual({
        resources: [{ resource: '*', label: 'All' }],
      });
    });

    it('PATCH permissions/users và DELETE roles/:id → { success: true }', async () => {
      const ctrl = new RbacRolesController(stub());
      await expect(
        ctrl.updateRolePermissions('r1', { permissions: [] }),
      ).resolves.toEqual({ success: true });
      await expect(
        ctrl.updateRoleUsers('r1', { userIds: [] }),
      ).resolves.toEqual({ success: true });
      await expect(ctrl.deleteRole('r1')).resolves.toEqual({ success: true });
    });
  });

  describe('facade: danh sách role (GET roles)', () => {
    it('trả { items, total, page, pageSize, totalPages } với users chỉ {id, email}', async () => {
      const { facade, roleRepository } = makeFacade();
      const createdAt = new Date('2026-01-01T00:00:00Z');
      roleRepository.createQueryBuilder.mockReturnValue(
        chainableQb([
          [
            {
              id: 'r1',
              name: 'Kế toán',
              description: 'mô tả',
              isActive: true,
              createdAt,
              userRoles: [
                { user: { id: 'u1', email: 'a@b.c', passwordHash: 'SECRET' } },
              ],
            },
          ],
          1,
        ]),
      );

      const result = await facade.getRolesPaginated({
        page: 1,
        pageSize: 20,
      } as any);

      expect(result).toEqual({
        items: [
          {
            id: 'r1',
            name: 'Kế toán',
            description: 'mô tả',
            is_active: true,
            createdAt,
            users: [{ id: 'u1', email: 'a@b.c' }],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(JSON.stringify(result)).not.toContain('SECRET');
    });
  });

  describe('facade: ghi role/quyền/người dùng', () => {
    it('createRole trả RoleResponse (không phải entity nguyên bản)', async () => {
      const { facade, roleRepository } = makeFacade();
      const saved = {
        id: 'r1',
        name: 'X',
        description: null,
        isActive: true,
        createdAt: 1,
        updatedAt: 2,
      };
      roleRepository.save.mockResolvedValue(saved);
      await expect(facade.createRole({ name: 'X' } as any)).resolves.toEqual(
        saved,
      );
    });

    it('updateRole không tồn tại → "Role not found"', async () => {
      const { facade, roleRepository } = makeFacade();
      roleRepository.findOne.mockResolvedValue(null);
      await expect(facade.updateRole('missing', {} as any)).rejects.toThrow(
        'Role not found',
      );
    });

    it('deleteRole xóa cứng và trả { success: true }', async () => {
      const { facade, roleRepository } = makeFacade();
      roleRepository.findOne.mockResolvedValue({ id: 'r1' });
      roleRepository.remove.mockResolvedValue({});
      await expect(facade.deleteRole('r1')).resolves.toEqual({ success: true });
      expect(roleRepository.remove).toHaveBeenCalledWith({ id: 'r1' });
    });

    it('updateRolePermissions thay toàn bộ quyền của role', async () => {
      const { facade, permissionRepository } = makeFacade();
      await facade.updateRolePermissions('r1', {
        permissions: [{ resource: 'garage', action: 'read' }],
      } as any);
      expect(permissionRepository.delete).toHaveBeenCalledWith({
        roleId: 'r1',
      });
      expect(permissionRepository.save).toHaveBeenCalled();
    });

    it('updateRoleUsers thay toàn bộ người dùng của role', async () => {
      const { facade, userRoleRepository } = makeFacade();
      await facade.updateRoleUsers('r1', { userIds: ['u1', 'u2'] });
      expect(userRoleRepository.delete).toHaveBeenCalledWith({ roleId: 'r1' });
      expect(userRoleRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
