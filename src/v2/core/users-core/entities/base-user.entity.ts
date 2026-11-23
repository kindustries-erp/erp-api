import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/**
 * Cột chung của tài khoản người dùng. Lớp con khai báo `@Entity`, tên bảng và index
 * (unique email, unique `employee_id` khi khác null).
 * Mọi cột thời gian dùng `timestamptz`: DB lưu thời điểm tuyệt đối, hiển thị theo múi giờ của client.
 */
export abstract class BaseUserEntity extends CoreSoftDeletableEntity {
  /** Email đăng nhập, luôn chữ thường và đã cắt khoảng trắng. */
  @Column({ type: 'varchar', length: 255, name: 'email' })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'ACTIVE' })
  status: string;

  /** Liên kết 1-1 với hồ sơ nhân viên. */
  @Column({ type: 'uuid', nullable: true, name: 'employee_id' })
  employeeId: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'password_changed_at' })
  passwordChangedAt: Date | null;
}
