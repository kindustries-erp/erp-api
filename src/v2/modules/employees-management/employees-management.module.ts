import { Module } from '@nestjs/common';
import { EmployeesCoreModule } from '@/v2/core/employees-core';
import { EmployeeManagementController } from './controllers/employee-management.controller';
import { EmployeesManagementService } from './employees-management.service';

/** Module HTTP của Employees (`/api/v2/employees`): controller và facade, import lõi `employees-core`. */
@Module({
  imports: [EmployeesCoreModule],
  controllers: [EmployeeManagementController],
  providers: [EmployeesManagementService],
  exports: [EmployeesManagementService, EmployeesCoreModule],
})
export class EmployeesManagementModule {}
