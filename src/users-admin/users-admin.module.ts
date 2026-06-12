import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditCoreModule } from '../audit-core/audit-core.module';
import { ErpEmployee } from '../employees-core/entities/erp_employee.entity';
import { UsersModule } from '../users/users.module';
import { CoreUser } from '../users/entities/core-user.entity';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CoreUser, ErpEmployee]),
    UsersModule,
    AuditCoreModule,
  ],
  controllers: [UsersAdminController],
  providers: [UsersAdminService],
  exports: [UsersAdminService],
})
export class UsersAdminModule {}
