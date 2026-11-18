import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '../../base-core/entities/core-soft-deletable.entity';

/**
 * Cột chung của chi nhánh toàn hệ thống. Lõi chỉ giữ base: bảng
 * (`branches_management`) và ràng buộc đặt tên bảng thuộc module `branches-management`.
 * Kế thừa chuỗi base-core: `id`, `extra_data`, `created_at`/`updated_at` (timestamptz), `is_deleted`.
 */
export abstract class BaseBranchEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 100, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'text', name: 'address', nullable: true })
  address: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
