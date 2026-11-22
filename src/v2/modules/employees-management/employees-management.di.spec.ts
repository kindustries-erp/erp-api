import { MODULE_METADATA } from '@nestjs/common/constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeManagementController } from './controllers/employee-management.controller';
import { EmployeesManagementModule } from './employees-management.module';
import { EmployeesManagementService } from './employees-management.service';
import { EmployeeCommandService } from './services/employee-command.service';
import { EmployeeQueryService } from './services/employee-query.service';

describe('EmployeesManagementModule wiring', () => {
  const meta = (key: string) =>
    Reflect.getMetadata(key, EmployeesManagementModule) as unknown[];

  it('đăng ký controller, service, và export repository cho module khác', () => {
    expect(meta(MODULE_METADATA.CONTROLLERS)).toEqual([
      EmployeeManagementController,
    ]);
    expect(meta(MODULE_METADATA.PROVIDERS)).toEqual(
      expect.arrayContaining([
        EmployeeQueryService,
        EmployeeCommandService,
        EmployeesManagementService,
      ]),
    );
    expect(meta(MODULE_METADATA.EXPORTS)).toContain(TypeOrmModule);
    expect(meta(MODULE_METADATA.EXPORTS)).toContain(EmployeesManagementService);
  });
});
