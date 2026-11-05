import { describe, expect, it, jest } from '@jest/globals';
import { RbacRolesService } from './rbac-roles.service';
import { RoleQueryService } from './services/role-query.service';
import { RoleCommandService } from './services/role-command.service';
import { RolePermissionsService } from './services/role-permissions.service';
import { RoleUsersService } from './services/role-users.service';

/** Facade: kiểm các method delegate đúng sub-service và danh sách resource. */
const makeFacade = () => {
  const query = {
    getRolesPaginated: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      items: [],
    })),
    getColumnOptions: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      items: [],
      total: 0,
      next: null,
    })),
  };
  const command = {
    createRole: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      id: 'r1',
    })),
    updateRole: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      id: 'r1',
    })),
    deleteRole: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      success: true,
    })),
  };
  const permissions = {
    getRolePermissions: jest.fn<(...args: any[]) => Promise<any>>(
      async () => [],
    ),
    updateRolePermissions: jest.fn<(...args: any[]) => Promise<any>>(
      async () => ({ success: true }),
    ),
  };
  const users = {
    getRoleUsers: jest.fn<(...args: any[]) => Promise<any>>(async () => []),
    updateRoleUsers: jest.fn<(...args: any[]) => Promise<any>>(async () => ({
      success: true,
    })),
  };
  const facade = new RbacRolesService(
    query as unknown as RoleQueryService,
    command as unknown as RoleCommandService,
    permissions as unknown as RolePermissionsService,
    users as unknown as RoleUsersService,
  );
  return { facade, query, command, permissions, users };
};

describe('RbacRolesService (Facade)', () => {
  it('delegate đọc danh sách và column-options sang RoleQueryService', async () => {
    const { facade, query } = makeFacade();
    await facade.getRolesPaginated({ page: 2 } as any);
    await facade.getColumnOptions('name', 'a', 1, 20, '{}');
    expect(query.getRolesPaginated).toHaveBeenCalledWith({ page: 2 });
    expect(query.getColumnOptions).toHaveBeenCalledWith(
      'name',
      'a',
      1,
      20,
      '{}',
    );
  });

  it('delegate ghi role sang RoleCommandService', async () => {
    const { facade, command } = makeFacade();
    await facade.createRole({ name: 'X' } as any);
    await facade.updateRole('r1', { name: 'Y' } as any);
    await facade.deleteRole('r1');
    expect(command.createRole).toHaveBeenCalledWith({ name: 'X' });
    expect(command.updateRole).toHaveBeenCalledWith('r1', { name: 'Y' });
    expect(command.deleteRole).toHaveBeenCalledWith('r1');
  });

  it('delegate quyền và người dùng của role', async () => {
    const { facade, permissions, users } = makeFacade();
    await facade.getRolePermissions('r1');
    await facade.updateRolePermissions('r1', { permissions: [] } as any);
    await facade.getRoleUsers('r1');
    await facade.updateRoleUsers('r1', { userIds: [] } as any);
    expect(permissions.getRolePermissions).toHaveBeenCalledWith('r1');
    expect(permissions.updateRolePermissions).toHaveBeenCalledWith('r1', {
      permissions: [],
    });
    expect(users.getRoleUsers).toHaveBeenCalledWith('r1');
    expect(users.updateRoleUsers).toHaveBeenCalledWith('r1', { userIds: [] });
  });

  describe('getAvailableResources', () => {
    it('liệt kê garage, bank_statements, cash_statements và loại trừ tài nguyên cũ', async () => {
      const { facade } = makeFacade();
      const resources = await facade.getAvailableResources();
      const keys = resources.map((r) => r.resource);

      expect(keys).toContain('garage');
      expect(keys).toContain('garage_goods_receipts');
      expect(keys).toContain('bank_statements');
      expect(keys).toContain('cash_statements');
      expect(keys).not.toContain('cash_funds');
      expect(keys).not.toContain('bank_accounts');
      expect(keys).not.toContain('greenway_integration');
      expect(keys).not.toContain('kgara_integration');
    });
  });
});
