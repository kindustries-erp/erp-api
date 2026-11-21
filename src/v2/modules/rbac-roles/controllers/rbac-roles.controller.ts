import { ApiOkResponse } from '@nestjs/swagger';
import { ColumnOptionsResponseDto } from '@/common/dto/column-options-response.dto';
import { RoleListResponseDto } from '../dto/rbac-response.dto';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
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

type ViewerRequest = Request & { user?: { email?: string } };

const viewerOf = (request?: ViewerRequest): string | null =>
  request?.user?.email ?? null;

/** Route chuẩn v2: /api/v2/rbac-roles/.... */
@ApiTags('RBAC Core')
@ApiBearerAuth()
@Controller('api/v2/rbac-roles')
@UseGuards(JwtAuthGuard, CoreRbacGuard)
export class RbacRolesController {
  constructor(private readonly rbacRolesService: RbacRolesService) {}

  // Route tĩnh khai báo trước route có :id để không bị nuốt.
  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @ApiOkResponse({ type: ColumnOptionsResponseDto })
  @Get('column-options')
  async getRolesColumnOptions(
    @Query('column') column: string,
    @Req() request: ViewerRequest,
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
      viewerOf(request),
    );
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

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @ApiOkResponse({ type: RoleListResponseDto })
  @Get()
  async getRoles(
    @Query() query: ListCoreRolesDto,
    @Req() request: ViewerRequest,
  ) {
    return this.rbacRolesService.getRolesPaginated(query, viewerOf(request));
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Post()
  async createRole(@Body() dto: CreateCoreRoleDto) {
    return this.rbacRolesService.createRole(dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get(':id')
  async getRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ViewerRequest,
  ) {
    return this.rbacRolesService.getRoleById(id, viewerOf(request));
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch(':id')
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoreRoleDto,
    @Req() request: ViewerRequest,
  ) {
    await this.rbacRolesService.assertRoleVisible(id, viewerOf(request));
    return this.rbacRolesService.updateRole(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Delete(':id')
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ViewerRequest,
  ) {
    await this.rbacRolesService.assertRoleVisible(id, viewerOf(request));
    return this.rbacRolesService.deleteRole(id);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get(':roleId/permissions')
  async getRolePermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Req() request: ViewerRequest,
  ) {
    await this.rbacRolesService.assertRoleVisible(roleId, viewerOf(request));
    const permissions = await this.rbacRolesService.getRolePermissions(roleId);
    return { permissions };
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch(':roleId/permissions')
  async updateRolePermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateCoreRolePermissionsDto,
    @Req() request: ViewerRequest,
  ) {
    await this.rbacRolesService.assertRoleVisible(roleId, viewerOf(request));
    return this.rbacRolesService.updateRolePermissions(roleId, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get(':roleId/users')
  async getRoleUsers(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Req() request: ViewerRequest,
  ) {
    await this.rbacRolesService.assertRoleVisible(roleId, viewerOf(request));
    const users = await this.rbacRolesService.getRoleUsers(
      roleId,
      viewerOf(request),
    );
    return { users };
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch(':roleId/users')
  async updateRoleUsers(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateCoreRoleUsersDto,
    @Req() request: ViewerRequest,
  ) {
    await this.rbacRolesService.assertRoleVisible(roleId, viewerOf(request));
    return this.rbacRolesService.updateRoleUsers(
      roleId,
      dto,
      viewerOf(request),
    );
  }
}
