import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreRole } from './entities/core-role.entity';
import { CorePermission } from './entities/core-permission.entity';
import { CoreUserRole } from './entities/core-user-role.entity';
import { RbacCoreService } from './services/rbac-core.service';

/**
 * Module lõi họ rbac: cung cấp engine kiểm quyền toàn cục.
 * Không có controller; API quản trị role nằm ở module `rbac-roles` (src/v2/modules).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CoreRole, CorePermission, CoreUserRole])],
  providers: [RbacCoreService],
  exports: [RbacCoreService],
})
export class RbacCoreModule {}
