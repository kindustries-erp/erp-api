import { Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseBranchExternalLinkEntity } from '@/v2/core/branches-core';
import type { BranchManagement } from './branch-management.entity';

/**
 * Liên kết chi nhánh hệ thống với định danh ở nguồn ngoài (Kgara: `external_id` + `account_key`).
 * Khóa duy nhất một phần theo bản ghi chưa xóa mềm.
 */
@Entity({ name: 'branches_management_external_links' })
@Index(
  'UQ_branches_management_external_links_active',
  ['source', 'externalId', 'accountKey'],
  { unique: true, where: '"is_deleted" = false' },
)
@Index('IDX_branches_management_external_links_branch_id', ['branchId'])
export class BranchManagementExternalLink extends BaseBranchExternalLinkEntity {
  @ManyToOne('BranchManagement', { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'branch_id' })
  branch?: BranchManagement;
}
