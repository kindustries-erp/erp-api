import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';

/**
 * Liên kết một chi nhánh hệ thống với định danh ở hệ ngoài (ví dụ Kgara:
 * `external_id` + `account_key`). Lõi chỉ giữ cột; bảng và quan hệ thuộc module.
 * `accountKey` rỗng ('') nghĩa là nguồn không phân tách theo tài khoản.
 */
export abstract class BaseBranchExternalLinkEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @Column({ type: 'varchar', length: 50, name: 'source' })
  source: string;

  @Column({ type: 'varchar', length: 100, name: 'external_id' })
  externalId: string;

  @Column({ type: 'varchar', length: 50, name: 'account_key', default: '' })
  accountKey: string;
}
