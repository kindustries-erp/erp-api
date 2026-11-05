import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreRole } from '@/v2/core/rbac/entities/core-role.entity';
import { CorePermission } from '@/v2/core/rbac/entities/core-permission.entity';
import { CoreUserRole } from '@/v2/core/rbac/entities/core-user-role.entity';
import { RbacRolesController } from './controllers/rbac-roles.controller';
import { RbacRolesService } from './rbac-roles.service';
import { RoleQueryService } from './services/role-query.service';
import { RoleCommandService } from './services/role-command.service';
import { RolePermissionsService } from './services/role-permissions.service';
import { RoleUsersService } from './services/role-users.service';

/** Module quản trị role (API /api/v1/rbac-core). Dùng engine kiểm quyền từ lõi rbac (@Global). */
@Module({
  imports: [TypeOrmModule.forFeature([CoreRole, CorePermission, CoreUserRole])],
  controllers: [RbacRolesController],
  providers: [
    RbacRolesService,
    RoleQueryService,
    RoleCommandService,
    RolePermissionsService,
    RoleUsersService,
  ],
  exports: [RbacRolesService],
})
export class RbacRolesModule {}
