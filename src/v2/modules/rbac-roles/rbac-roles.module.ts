import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacRole } from '@/v2/modules/rbac-roles/entities/rbac-role.entity';
import { RbacPermission } from '@/v2/modules/rbac-roles/entities/rbac-permission.entity';
import { RbacUserRole } from '@/v2/modules/rbac-roles/entities/rbac-user-role.entity';
import { RbacAccessService } from '@/v2/core/rbac-core';
import { TypeOrmRbacAccessService } from './services/rbac-access.service';
import { RbacRolesController } from './controllers/rbac-roles.controller';
import { RbacRolesService } from './rbac-roles.service';
import { RoleQueryService } from './services/role-query.service';
import { RoleCommandService } from './services/role-command.service';
import { RolePermissionsService } from './services/role-permissions.service';
import { RoleUsersService } from './services/role-users.service';

/**
 * Module quản trị role (API /api/v2/rbac-roles), đồng thời cung cấp toàn cục engine kiểm quyền
 * (token `RbacAccessService` của lõi rbac, cài đặt TypeORM).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RbacRole, RbacPermission, RbacUserRole])],
  controllers: [RbacRolesController],
  providers: [
    RbacRolesService,
    RoleQueryService,
    RoleCommandService,
    RolePermissionsService,
    RoleUsersService,
    TypeOrmRbacAccessService,
    { provide: RbacAccessService, useExisting: TypeOrmRbacAccessService },
  ],
  exports: [RbacRolesService, RbacAccessService],
})
export class RbacRolesModule {}
