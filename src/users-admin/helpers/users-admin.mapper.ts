import type { ErpEmployee } from '../../employees-core/entities/erp_employee.entity';
import type { CoreUser } from '../../users/entities/core-user.entity';

/** Dạng an toàn của user admin v1 (không có `passwordHash`). */
export function toSafeUser(user: CoreUser, employee?: ErpEmployee | null) {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    employeeId: user.employeeId,
    legacyDirectusUserId: user.legacyDirectusUserId,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    employee: employee
      ? {
          id: employee.id,
          fullName: employee.fullName,
          employeeCode: employee.employeeCode,
          email: employee.email,
          phone: employee.phone,
          status: employee.status,
        }
      : null,
  };
}
