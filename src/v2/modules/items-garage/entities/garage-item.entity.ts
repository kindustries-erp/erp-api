import { Column, Entity, Index } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/** Danh mục mã hàng của garage. Mã duy nhất trong các dòng chưa xóa mềm. */
@Entity('items_garage')
@Index('UQ_items_garage_item_code', ['itemCode'], {
  unique: true,
  where: '"is_deleted" = false',
})
@Index('IDX_items_garage_name_normalized', ['nameNormalized'])
export class GarageItem extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 128, name: 'item_code' })
  itemCode: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  /** Tên bỏ dấu, chữ thường; server tự tính để so khớp. */
  @Column({ type: 'varchar', length: 255, name: 'name_normalized' })
  nameNormalized: string;

  @Column({ type: 'varchar', length: 50, name: 'unit', nullable: true })
  unit?: string;

  /** Nhóm hàng theo tiền tố mã: VF, PT, VT, DV, CK, CCDC, HC. */
  @Column({ type: 'varchar', length: 16, name: 'item_type', nullable: true })
  itemType?: string;

  /** Nguồn tạo: SEED, AI, MANUAL. */
  @Column({ type: 'varchar', length: 16, name: 'source', default: 'MANUAL' })
  source: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}
