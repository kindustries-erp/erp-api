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
  Header,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  UpdateRolePermissionsDto,
} from './dto/update-permission.dto';
import { UpdateRoleUsersDto } from './dto/update-role-users.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac')
@UseGuards(DirectusAuthGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles-table')
  @Header('Cache-Control', 'no-store')
  async getRbacTable() {
    return this.rbacService.getRbacTable();
  }

  @Get('roles')
  @Header('Cache-Control', 'no-store')
  async getRoles(
    @Query() query: { page?: string; pageSize?: string; search?: string },
  ) {
    return this.rbacService.getRolesPaginated(query);
  }

  @Post('roles')
  async createRole(@Body() dto: any) {
    return this.rbacService.createRole(dto);
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: any) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Get('collections/:collection/fields')
  @Header('Cache-Control', 'no-store')
  async getCollectionFields(@Param('collection') collection: string) {
    return this.rbacService.getCollectionFields(collection);
  }

  @Get('permissions/:id/editor')
  @Header('Cache-Control', 'no-store')
  async getPermissionEditor(@Param('id') id: string) {
    return this.rbacService.getPermissionEditor(id);
  }

  @Get('permissions/:id')
  @Header('Cache-Control', 'no-store')
  async getPermission(@Param('id') id: string) {
    return this.rbacService.getPermission(id);
  }

  @Post('permissions')
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.rbacService.createPermission(dto);
  }

  @Patch('permissions/:id')
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(id, dto);
  }

  @Delete('permissions/:id')
  async deletePermission(@Param('id') id: string) {
    return this.rbacService.deletePermission(id);
  }

  @Get('roles/:roleId/permissions')
  @Header('Cache-Control', 'no-store')
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.rbacService.getRolePermissions(roleId);
  }

  @Patch('roles/:roleId/permissions')
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() payload: UpdateRolePermissionsDto,
  ) {
    return this.rbacService.updateRolePermissions(roleId, payload);
  }

  @Get('roles/:roleId/users')
  @Header('Cache-Control', 'no-store')
  async getRoleUsers(@Param('roleId') roleId: string) {
    return this.rbacService.getRoleUsers(roleId);
  }

  @Patch('roles/:roleId/users')
  async updateRoleUsers(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleUsersDto,
  ) {
    return this.rbacService.updateRoleUsers(roleId, dto);
  }
}
