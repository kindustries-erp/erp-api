import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/**
 * Cột chung của danh mục mã hàng. Lớp con khai báo `@Entity`, tên bảng và các index
 * (unique mã trong các dòng chưa xóa mềm, index tên chuẩn hóa).
 */
export abstract class BaseItemEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 128, name: 'item_code' })
  itemCode: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  /** Tên bỏ dấu, chữ thường; server tự tính để so khớp. */
  @Column({ type: 'varchar', length: 255, name: 'name_normalized' })
  nameNormalized: string;

  @Column({ type: 'varchar', length: 50, name: 'unit', nullable: true })
  unit?: string;

  /** Nhóm hàng theo tiền tố mã; danh sách nhóm do module biến thể khai báo. */
  @Column({ type: 'varchar', length: 16, name: 'item_type', nullable: true })
  itemType?: string;

  /** Nguồn tạo: SEED, AI, MANUAL. */
  @Column({ type: 'varchar', length: 16, name: 'source', default: 'MANUAL' })
  source: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}
