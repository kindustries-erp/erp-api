import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Bảng lưu trữ thông tin tracking cho các mặt hàng có trackingPolicy = CUSTOM.
 * Sử dụng cột JSONB `customMetadata` để linh hoạt lưu trữ các thuộc tính
 * do người dùng tự định nghĩa theo từng nhóm sản phẩm (trackingCategory).
 *
 * Ví dụ custom_metadata cho kim cương:
 *   { "cut": "Excellent", "color": "D", "clarity": "VVS1", "carat": 1.5 }
 */
@Entity({ name: 'erp_inventory_tracking_customs' })
export class ErpInventoryTrackingCustom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'IN_STOCK' })
  status: string;

  @Column({ type: 'jsonb', name: 'custom_metadata', nullable: true })
  customMetadata: Record<string, any> | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
