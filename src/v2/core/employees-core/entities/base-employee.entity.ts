import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';

/**
 * Cột chung của nhân viên cho mọi ngành. Lõi chỉ giữ cột: bảng (`employees_management`),
 * ràng buộc unique một phần và quan hệ tới chi nhánh thuộc module `employees-management`.
 * Kế thừa chuỗi base-core: `id`, `extra_data`, `created_at`/`updated_at` (timestamptz), `is_deleted`.
 */
export abstract class BaseEmployeeEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 255, name: 'employee_code' })
  employeeCode: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 255, name: 'email', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, name: 'phone', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'ACTIVE' })
  status: string;

  // Chỉ users-management ghi (liên kết 1-1 tài khoản); API nhân viên không nhận field này
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'text', name: 'address', nullable: true })
  address: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', name: 'birth_date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'timestamptz', name: 'start_date', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamptz', name: 'leave_date', nullable: true })
  leaveDate: Date | null;

  @Column({ type: 'varchar', length: 255, name: 'job_title', nullable: true })
  jobTitle: string | null;

  @Column({ type: 'varchar', length: 255, name: 'department', nullable: true })
  department: string | null;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  // CCCD/CMND: dữ liệu nhạy cảm. Không đưa vào tìm kiếm chung, response chỉ trả bản che
  @Column({ type: 'varchar', length: 20, name: 'national_id', nullable: true })
  nationalId: string | null;
}
