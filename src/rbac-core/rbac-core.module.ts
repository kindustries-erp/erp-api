import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreRole } from './entities/core-role.entity';
import { CorePermission } from './entities/core-permission.entity';
import { CoreUserRole } from './entities/core-user-role.entity';
import { RbacCoreService } from './rbac-core.service';
import { RbacCoreController } from './rbac-core.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CoreRole, CorePermission, CoreUserRole])],
  controllers: [RbacCoreController],
  providers: [RbacCoreService],
  exports: [RbacCoreService],
})
export class RbacCoreModule {}
