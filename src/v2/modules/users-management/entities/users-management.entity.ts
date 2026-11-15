import { Entity, Index } from 'typeorm';
import { BaseUserEntity } from '@/v2/core/users-core';

/**
 * Tài khoản người dùng ERP (v2). Bảng tách khỏi `core_users` (v1).
 * Đồng bộ sang `core_users` ở command service (cùng transaction) để auth, RBAC
 * và các FK cũ vẫn hoạt động cho tới khi cutover.
 */
@Entity({ name: 'users_management' })
@Index('UQ_users_management_email', ['email'], { unique: true })
@Index('UQ_users_management_employee_id', ['employeeId'], {
  unique: true,
  where: '"employee_id" IS NOT NULL',
})
export class UsersManagement extends BaseUserEntity {}
