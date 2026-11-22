import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeManagementController } from './controllers/employee-management.controller';
import { EmployeeManagement } from './entities/employee-management.entity';
import { EmployeesManagementService } from './employees-management.service';
import { EmployeeCommandService } from './services/employee-command.service';
import { EmployeeQueryService } from './services/employee-query.service';

/**
 * Module Employees (`/api/v2/employees`, bảng `employees_management`): entity, service, controller.
 * Export `TypeOrmModule` để module khác (users-management) dùng repository nhân viên.
 */
@Module({
  imports: [TypeOrmModule.forFeature([EmployeeManagement])],
  controllers: [EmployeeManagementController],
  providers: [
    EmployeeQueryService,
    EmployeeCommandService,
    EmployeesManagementService,
  ],
  exports: [
    TypeOrmModule,
    EmployeeQueryService,
    EmployeeCommandService,
    EmployeesManagementService,
  ],
})
export class EmployeesManagementModule {}
