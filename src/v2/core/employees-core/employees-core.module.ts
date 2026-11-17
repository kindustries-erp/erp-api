import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeManagement } from './entities/employee-management.entity';
import { EmployeeQueryService } from './services/employee-query.service';
import { EmployeeCommandService } from './services/employee-command.service';
import { EmployeesCoreService } from './services/employees-core.service';

/**
 * Module lõi của họ Employees V2 (bảng `employees_management`).
 * Không chứa REST Controller; HTTP nằm ở module `employees-management`.
 * Export TypeOrmModule để module khác (users-management) dùng repository nhân viên.
 */
@Module({
  imports: [TypeOrmModule.forFeature([EmployeeManagement])],
  providers: [
    EmployeeQueryService,
    EmployeeCommandService,
    EmployeesCoreService,
  ],
  exports: [
    TypeOrmModule,
    EmployeeQueryService,
    EmployeeCommandService,
    EmployeesCoreService,
  ],
})
export class EmployeesCoreModule {}
