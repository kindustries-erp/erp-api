import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsV2Module } from '@/v2/modules/audit-logs/audit-logs-v2.module';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import { UsersManagementController } from './controllers/users-management.controller';
import { UsersManagement } from './entities/users-management.entity';
import { UsersManagementCommandService } from './services/users-management-command.service';
import { UsersManagementQueryService } from './services/users-management-query.service';
import { UsersAuditWriter } from './services/users-audit.writer';
import { UsersAuthService } from './services/users-auth.service';
import { UsersEmployeeLinkService } from './services/users-employee-link.service';
import { UsersManagementService } from './users-management.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsersManagement,
      EmployeeManagement,
      CoreUser,
      CoreRefreshToken,
    ]),
    AuditLogsV2Module,
  ],
  controllers: [UsersManagementController],
  providers: [
    UsersManagementService,
    UsersManagementQueryService,
    UsersManagementCommandService,
    UsersEmployeeLinkService,
    UsersAuditWriter,
    UsersAuthService,
  ],
  exports: [UsersManagementService, UsersAuthService],
})
export class UsersManagementModule {}
