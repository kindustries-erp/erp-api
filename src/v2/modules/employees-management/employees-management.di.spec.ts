import { MODULE_METADATA } from '@nestjs/common/constants';
import { EmployeesCoreModule } from '@/v2/core/employees-core';
import { EmployeeManagementController } from './controllers/employee-management.controller';
import { EmployeesManagementModule } from './employees-management.module';
import { EmployeesManagementService } from './employees-management.service';

describe('EmployeesManagementModule wiring', () => {
  const meta = (key: string) =>
    Reflect.getMetadata(key, EmployeesManagementModule) as unknown[];

  it('import lõi, đăng ký controller và facade, export lõi cho module khác', () => {
    expect(meta(MODULE_METADATA.IMPORTS)).toContain(EmployeesCoreModule);
    expect(meta(MODULE_METADATA.CONTROLLERS)).toEqual([
      EmployeeManagementController,
    ]);
    expect(meta(MODULE_METADATA.PROVIDERS)).toContain(
      EmployeesManagementService,
    );
    expect(meta(MODULE_METADATA.EXPORTS)).toContain(EmployeesCoreModule);
  });
});
