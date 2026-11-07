import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/v2/core/rbac-core';
import { RbacRolesService } from '../rbac-roles.service';
import {
  CreateCoreRoleDto,
  ListCoreRolesDto,
  UpdateCoreRoleDto,
  UpdateCoreRolePermissionsDto,
  UpdateCoreRoleUsersDto,
} from '../dto/rbac-core.dto';

/** Route giữ nguyên như v1: /api/v1/rbac-core/... (UI không đổi). */
@ApiTags('RBAC Core')
@ApiBearerAuth()
@Controller('rbac-core')
@UseGuards(JwtAuthGuard, CoreRbacGuard)
export class RbacRolesController {
  constructor(private readonly rbacRolesService: RbacRolesService) {}

  // Route tĩnh khai báo trước route có :id để không bị nuốt.
  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles/column-options')
  async getRolesColumnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filters') filters?: string,
  ) {
    return this.rbacRolesService.getColumnOptions(
      column,
      search,
      parseInt(page, 10) || 1,
      parseInt(pageSize, 10) || 20,
      filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles')
  async getRoles(@Query() query: ListCoreRolesDto) {
    return this.rbacRolesService.getRolesPaginated(query);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Post('roles')
  async createRole(@Body() dto: CreateCoreRoleDto) {
    return this.rbacRolesService.createRole(dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles/:id')
  async getRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacRolesService.getRoleById(id);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch('roles/:id')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoreRoleDto,
  ) {
    return this.rbacRolesService.updateRole(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Delete('roles/:id')
  async deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbacRolesService.deleteRole(id);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles/:roleId/permissions')
  async getRolePermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    const permissions = await this.rbacRolesService.getRolePermissions(roleId);
    return { permissions };
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch('roles/:roleId/permissions')
  async updateRolePermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateCoreRolePermissionsDto,
  ) {
    return this.rbacRolesService.updateRolePermissions(roleId, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles/:roleId/users')
  async getRoleUsers(@Param('roleId', ParseUUIDPipe) roleId: string) {
    const users = await this.rbacRolesService.getRoleUsers(roleId);
    return { users };
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch('roles/:roleId/users')
  async updateRoleUsers(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateCoreRoleUsersDto,
  ) {
    return this.rbacRolesService.updateRoleUsers(roleId, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('collections')
  async getAvailableResources() {
    const resources = await this.rbacRolesService.getAvailableResources();
    return { resources };
  }
}
