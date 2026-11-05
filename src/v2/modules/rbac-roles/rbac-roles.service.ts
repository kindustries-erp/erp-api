import { Injectable } from '@nestjs/common';
import {
  RoleQueryService,
  type RoleColumnOptionsResponse,
} from './services/role-query.service';
import { RoleCommandService } from './services/role-command.service';
import { RolePermissionsService } from './services/role-permissions.service';
import { RoleUsersService } from './services/role-users.service';
import { AVAILABLE_RBAC_RESOURCES } from './helpers/available-resources.data';
import {
  ListCoreRolesDto,
  CreateCoreRoleDto,
  UpdateCoreRoleDto,
  UpdateCoreRolePermissionsDto,
  UpdateCoreRoleUsersDto,
} from './dto/rbac-core.dto';
import type {
  PermissionResponse,
  RoleListResponse,
  RoleResponse,
  RoleUserResponse,
} from './dto/rbac-response.dto';

/** Facade quản trị role: điều phối các sub-service, luôn trả response DTO. */
@Injectable()
export class RbacRolesService {
  constructor(
    private readonly queryService: RoleQueryService,
    private readonly commandService: RoleCommandService,
    private readonly permissionsService: RolePermissionsService,
    private readonly usersService: RoleUsersService,
  ) {}

  getRolesPaginated(query: ListCoreRolesDto): Promise<RoleListResponse> {
    return this.queryService.getRolesPaginated(query);
  }

  getColumnOptions(
    column: string,
    search?: string,
    page?: number,
    pageSize?: number,
    filtersStr?: string,
  ): Promise<RoleColumnOptionsResponse> {
    return this.queryService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
    );
  }

  createRole(dto: CreateCoreRoleDto): Promise<RoleResponse> {
    return this.commandService.createRole(dto);
  }

  updateRole(id: string, dto: UpdateCoreRoleDto): Promise<RoleResponse> {
    return this.commandService.updateRole(id, dto);
  }

  deleteRole(id: string): Promise<{ success: boolean }> {
    return this.commandService.deleteRole(id);
  }

  getRolePermissions(roleId: string): Promise<PermissionResponse[]> {
    return this.permissionsService.getRolePermissions(roleId);
  }

  updateRolePermissions(
    roleId: string,
    dto: UpdateCoreRolePermissionsDto,
  ): Promise<{ success: boolean }> {
    return this.permissionsService.updateRolePermissions(roleId, dto);
  }

  getRoleUsers(roleId: string): Promise<RoleUserResponse[]> {
    return this.usersService.getRoleUsers(roleId);
  }

  updateRoleUsers(
    roleId: string,
    dto: UpdateCoreRoleUsersDto,
  ): Promise<{ success: boolean }> {
    return this.usersService.updateRoleUsers(roleId, dto);
  }

  getAvailableResources(): Promise<{ resource: string; label: string }[]> {
    return Promise.resolve(AVAILABLE_RBAC_RESOURCES);
  }
}
