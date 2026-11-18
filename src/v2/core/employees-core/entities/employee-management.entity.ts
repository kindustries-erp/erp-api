import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';
import type { BranchRef } from '../../branches-core/contracts/branch.contract';

/**
 * Nhân viên (v2). Bảng mới `employees_management`, tách khỏi `erp_employees` (v1).
 * Kế thừa chuỗi base-core: `id`, `extra_data`, `created_at`/`updated_at` (timestamptz), `is_deleted`.
 * Ngày (sinh, vào làm, nghỉ) dùng timestamptz theo chuẩn v2; UI gửi/hiển thị theo giờ VN.
 */
@Entity({ name: 'employees_management' })
export class EmployeeManagement extends CoreSoftDeletableEntity {
  // Chỉ bản ghi chưa xóa mềm giữ mã duy nhất, để mã đã xóa dùng lại được
  @Index('UQ_employees_management_code_active', ['employeeCode'], {
    unique: true,
    where: '"is_deleted" = false',
  })
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
  @Index('UQ_employees_management_user_id', ['userId'], {
    unique: true,
    where: '"user_id" IS NOT NULL AND "is_deleted" = false',
  })
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

  // Quan hệ chuỗi tới `BranchManagement` (module branches-management): lõi không import module.
  @ManyToOne('BranchManagement', { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'branch_id' })
  branch?: BranchRef | null;

  // CCCD/CMND: dữ liệu nhạy cảm. Không đưa vào tìm kiếm chung, response chỉ trả bản che
  @Index('UQ_employees_management_national_id_active', ['nationalId'], {
    unique: true,
    where: '"national_id" IS NOT NULL AND "is_deleted" = false',
  })
  @Column({ type: 'varchar', length: 20, name: 'national_id', nullable: true })
  nationalId: string | null;
}
