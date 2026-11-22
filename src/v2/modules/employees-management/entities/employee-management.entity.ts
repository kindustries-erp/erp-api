import { Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEmployeeEntity } from '@/v2/core/employees-core';
import type { BranchRef } from '@/v2/core/branches-core';

/**
 * Nhân viên (v2). Bảng mới `employees_management`, tách khỏi `erp_employees` (v1).
 * Cột chung kế thừa `BaseEmployeeEntity` (lõi `employees-core`); ràng buộc unique một phần và
 * quan hệ chi nhánh nằm ở module. Ngày (sinh, vào làm, nghỉ) dùng timestamptz theo chuẩn v2.
 */
// Chỉ bản ghi chưa xóa mềm giữ mã duy nhất, để mã đã xóa dùng lại được
@Index('UQ_employees_management_code_active', ['employeeCode'], {
  unique: true,
  where: '"is_deleted" = false',
})
// Chỉ users-management ghi (liên kết 1-1 tài khoản)
@Index('UQ_employees_management_user_id', ['userId'], {
  unique: true,
  where: '"user_id" IS NOT NULL AND "is_deleted" = false',
})
@Index('UQ_employees_management_national_id_active', ['nationalId'], {
  unique: true,
  where: '"national_id" IS NOT NULL AND "is_deleted" = false',
})
@Entity({ name: 'employees_management' })
export class EmployeeManagement extends BaseEmployeeEntity {
  // Quan hệ chuỗi tới `BranchManagement` (module branches-management): tránh vòng import.
  @ManyToOne('BranchManagement', { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'branch_id' })
  branch?: BranchRef | null;
}
