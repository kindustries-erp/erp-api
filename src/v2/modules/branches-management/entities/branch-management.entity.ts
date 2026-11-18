import { Entity, Index } from 'typeorm';
import { BaseBranchEntity } from '@/v2/core/branches-core';

/**
 * Chi nhánh toàn hệ thống (v2). Bảng `branches_management`, đổi tên từ `erp_branches`
 * và giữ nguyên id/dữ liệu. Mã chỉ duy nhất trong các bản ghi chưa xóa mềm.
 */
@Entity({ name: 'branches_management' })
@Index('UQ_branches_management_code_active', ['code'], {
  unique: true,
  where: '"is_deleted" = false',
})
export class BranchManagement extends BaseBranchEntity {}
