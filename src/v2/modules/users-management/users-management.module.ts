import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditCoreModule } from '@/audit-core/audit-core.module';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { ErpEmployee } from '@/employees-core/entities/erp_employee.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import { UsersManagementController } from './controllers/users-management.controller';
import { UsersManagement } from './entities/users-management.entity';
import { UsersManagementCommandService } from './services/users-management-command.service';
import { UsersManagementQueryService } from './services/users-management-query.service';
import { UsersAuditWriter } from './services/users-audit.writer';
import { UsersEmployeeLinkService } from './services/users-employee-link.service';
import { UsersManagementService } from './users-management.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsersManagement,
      ErpEmployee,
      CoreUser,
      CoreRefreshToken,
    ]),
    AuditCoreModule,
  ],
  controllers: [UsersManagementController],
  providers: [
    UsersManagementService,
    UsersManagementQueryService,
    UsersManagementCommandService,
    UsersEmployeeLinkService,
    UsersAuditWriter,
  ],
  exports: [UsersManagementService],
})
export class UsersManagementModule {}
