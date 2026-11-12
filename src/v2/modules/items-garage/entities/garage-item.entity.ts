import { Entity, Index } from 'typeorm';
import { BaseItemEntity } from '@/v2/core/items-core';

/**
 * Danh mục mã hàng của garage. Mã duy nhất trong các dòng chưa xóa mềm.
 * Nhóm hàng (`itemType`) theo tiền tố mã: VF, PT, VT, DV, CK, CCDC, HC.
 */
@Entity('items_garage')
@Index('UQ_items_garage_item_code', ['itemCode'], {
  unique: true,
  where: '"is_deleted" = false',
})
@Index('IDX_items_garage_name_normalized', ['nameNormalized'])
export class GarageItem extends BaseItemEntity {}
