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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RbacCoreService } from './rbac-core.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import {
  CreateCoreRoleDto,
  ListCoreRolesDto,
  UpdateCoreRoleDto,
  UpdateCoreRolePermissionsDto,
  UpdateCoreRoleUsersDto,
} from './dto/rbac-core.dto';

@ApiTags('RBAC Core (Neon)')
@ApiBearerAuth()
@Controller('rbac-core')
@UseGuards(JwtAuthGuard, CoreRbacGuard)
export class RbacCoreController {
  constructor(private readonly rbacCoreService: RbacCoreService) {}

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
    return this.rbacCoreService.getColumnOptions(
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
    return this.rbacCoreService.getRolesPaginated(query);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Post('roles')
  async createRole(@Body() dto: CreateCoreRoleDto) {
    return this.rbacCoreService.createRole(dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateCoreRoleDto) {
    return this.rbacCoreService.updateRole(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    return this.rbacCoreService.deleteRole(id);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles/:roleId/permissions')
  async getRolePermissions(@Param('roleId') roleId: string) {
    const permissions = await this.rbacCoreService.getRolePermissions(roleId);
    return { permissions };
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch('roles/:roleId/permissions')
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateCoreRolePermissionsDto,
  ) {
    return this.rbacCoreService.updateRolePermissions(roleId, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('roles/:roleId/users')
  async getRoleUsers(@Param('roleId') roleId: string) {
    const users = await this.rbacCoreService.getRoleUsers(roleId);
    return { users };
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Patch('roles/:roleId/users')
  async updateRoleUsers(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateCoreRoleUsersDto,
  ) {
    return this.rbacCoreService.updateRoleUsers(roleId, dto);
  }

  @RequirePermissions({
    resource: ErpResource.ADMIN_USERS,
    action: ErpAction.MANAGE,
  })
  @Get('collections')
  async getAvailableResources() {
    const resources = await this.rbacCoreService.getAvailableResources();
    return { resources };
  }
}
