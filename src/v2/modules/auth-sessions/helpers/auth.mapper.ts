import type { EmployeeManagement } from '@/v2/core/employees-core/entities/employee-management.entity';
import type { UsersManagement } from '../../users-management/entities/users-management.entity';
import type {
  AuthPreferencesDto,
  AuthUserDto,
  ProfileEmployeeDto,
} from '../dto/auth-response.dto';

export function toAuthUser(user: UsersManagement): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    employeeId: user.employeeId,
    legacyDirectusUserId: user.legacyDirectusUserId,
  };
}

export function toPreferences(p: AuthPreferencesDto): AuthPreferencesDto {
  return {
    theme: p.theme,
    language: p.language,
    tableConfigs: p.tableConfigs,
    uiConfigs: p.uiConfigs,
  };
}

export function toProfileEmployee(e: EmployeeManagement): ProfileEmployeeDto {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    email: e.email ?? null,
    phone: e.phone ?? null,
    status: e.status,
    userId: e.userId ?? null,
  };
}
