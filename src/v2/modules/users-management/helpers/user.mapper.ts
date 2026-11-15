import type { EmployeeManagement } from '@/v2/core/employees-core/entities/employee-management.entity';
import { UsersManagement } from '../entities/users-management.entity';
import {
  UserEmployeeSummaryDto,
  UserResponseDto,
} from '../dto/user-response.dto';

function toEmployeeSummary(
  employee: EmployeeManagement,
): UserEmployeeSummaryDto {
  return {
    id: employee.id,
    fullName: employee.fullName,
    employeeCode: employee.employeeCode,
    email: employee.email ?? undefined,
    phone: employee.phone ?? undefined,
    status: employee.status,
  };
}

/** Entity sang response DTO. Hàm thuần, không gọi DB, không lộ `passwordHash`. */
export function toUserResponse(
  entity: UsersManagement,
  employee?: EmployeeManagement | null,
): UserResponseDto {
  return {
    id: entity.id,
    extraData: entity.extraData ?? {},
    email: entity.email,
    status: entity.status,
    employeeId: entity.employeeId ?? null,
    legacyDirectusUserId: entity.legacyDirectusUserId ?? null,
    lastLoginAt: entity.lastLoginAt ?? null,
    passwordChangedAt: entity.passwordChangedAt ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    employee: employee ? toEmployeeSummary(employee) : null,
  };
}
