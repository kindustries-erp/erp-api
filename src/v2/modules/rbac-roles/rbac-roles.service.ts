import { Injectable } from '@nestjs/common';
import {
  RoleQueryService,
  type RoleColumnOptionsResponse,
} from './services/role-query.service';
import { RoleCommandService } from './services/role-command.service';
import { RolePermissionsService } from './services/role-permissions.service';
import { RoleUsersService } from './services/role-users.service';
import {
  AVAILABLE_RBAC_RESOURCES,
  type AvailableRbacResource,
} from './helpers/available-resources.data';
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

  getRolesPaginated(
    query: ListCoreRolesDto,
    viewerEmail?: string | null,
  ): Promise<RoleListResponse> {
    return this.queryService.getRolesPaginated(query, viewerEmail);
  }

  getRoleById(id: string, viewerEmail?: string | null): Promise<RoleResponse> {
    return this.queryService.getRoleById(id, viewerEmail);
  }

  /** Role test với người không có quyền: ném 404 trước khi thao tác theo id. */
  async assertRoleVisible(id: string, viewerEmail?: string | null) {
    await this.queryService.getRoleById(id, viewerEmail);
  }

  getColumnOptions(
    column: string,
    search?: string,
    page?: number,
    pageSize?: number,
    filtersStr?: string,
    viewerEmail?: string | null,
  ): Promise<RoleColumnOptionsResponse> {
    return this.queryService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
      viewerEmail,
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

  getRoleUsers(
    roleId: string,
    viewerEmail?: string | null,
  ): Promise<RoleUserResponse[]> {
    return this.usersService.getRoleUsers(roleId, viewerEmail);
  }

  updateRoleUsers(
    roleId: string,
    dto: UpdateCoreRoleUsersDto,
    viewerEmail?: string | null,
  ): Promise<{ success: boolean }> {
    return this.usersService.updateRoleUsers(roleId, dto, viewerEmail);
  }

  getAvailableResources(): Promise<AvailableRbacResource[]> {
    return Promise.resolve(AVAILABLE_RBAC_RESOURCES);
  }
}
