import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Danh mục trạm lắp ráp trong dây chuyền sản xuất.
 * Dùng ở giai đoạn 2 khi triển khai Shop Floor UI và scan QR tại trạm.
 *
 * Ví dụ trạm:
 *  - CP-FRAME:    Trạm Khung Xe
 *  - CP-ENGINE:   Trạm Lắp Động Cơ
 *  - CP-BATTERY:  Trạm Lắp Pin
 *  - CP-ELECTRIC: Trạm Điện Tử
 *  - CP-QC:       Trạm Kiểm Tra Chất Lượng
 */
@Entity({ name: 'erp_production_checkpoints' })
export class ErpProductionCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'code', unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
