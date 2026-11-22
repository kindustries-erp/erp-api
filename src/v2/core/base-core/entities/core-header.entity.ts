import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from './core-soft-deletable.entity';

/**
 * Header chứng từ có vòng đời trạng thái: `status` mặc định DRAFT, `created_by` lấy từ JWT.
 * Module có quy ước khác thì override bằng cách khai báo lại cột ở lớp con (cột lớp cha được ưu tiên khi trùng tên).
 */
export abstract class CoreHeaderEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 50, default: 'DRAFT', name: 'status' })
  status: string;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string | null;
}
