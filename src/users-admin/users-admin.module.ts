import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditCoreModule } from '../audit-core/audit-core.module';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { UsersManagementModule } from '@/v2/modules/users-management/users-management.module';
import { CoreUser } from '../users/entities/core-user.entity';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminQueryService } from './users-admin-query.service';
import { UsersAdminService } from './users-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoreUser, ErpEmployee]),
    UsersManagementModule,
    AuditCoreModule,
  ],
  controllers: [UsersAdminController],
  providers: [UsersAdminService, UsersAdminQueryService],
  exports: [UsersAdminService],
})
export class UsersAdminModule {}
