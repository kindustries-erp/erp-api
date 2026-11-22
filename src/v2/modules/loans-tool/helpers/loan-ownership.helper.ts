import { ForbiddenException } from '@nestjs/common';
import { ErpAction, ErpResource, RbacCoreService } from '@/v2/core/rbac-core';
import { LoanEntity } from '../entities';

/**
 * Kiểm tra xem người dùng có quyền quản trị cấp cao trên module khoản vay hoặc hệ thống không.
 */
export async function isLoanSuperAdmin(
  rbacCoreService: RbacCoreService,
  userId?: string,
): Promise<boolean> {
  if (!userId) return false;
  return rbacCoreService.hasAnyPermission(userId, [
    { resource: ErpResource.SUPER_ADMIN, action: ErpAction.ALL },
    { resource: ErpResource.ADMIN_USERS, action: ErpAction.MANAGE },
    { resource: ErpResource.LOANS, action: ErpAction.MANAGE },
  ]);
}

/**
 * Kiểm tra quyền sở hữu đối với khoản vay cụ thể (Row-level ownership).
 * Ném ForbiddenException nếu khoản vay thuộc về người khác và không có quyền Super Admin.
 */
export function assertLoanOwnership(
  loan: LoanEntity,
  userId?: string,
  isSuperAdmin = false,
): void {
  if (isSuperAdmin) return;
  if (userId && loan.createdBy && loan.createdBy !== userId) {
    throw new ForbiddenException(
      'Bạn không có quyền thao tác trên khoản vay của người khác',
    );
  }
}

export function generateLoanCode(): string {
  const timestamp = Date.now().toString().slice(-6);
  return `LOAN-${timestamp}`;
}

export function resolveFirstPaymentDate(
  startDate: string,
  firstPaymentDate?: string | null,
): string {
  if (firstPaymentDate && firstPaymentDate >= startDate) {
    return firstPaymentDate;
  }
  return startDate;
}
