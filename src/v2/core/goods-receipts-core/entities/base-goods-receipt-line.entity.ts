import { Column, Index } from 'typeorm';
import { CoreAuditedEntity } from '../../base-core/entities/core-audited.entity';
import { IVoucherLine } from '../contracts/voucher.contract';

/**
 * Abstract Base Entity cho bảng Line chi tiết hàng hóa của chứng từ Nhập kho.
 * KHÔNG gắn @Entity() ở đây để các module con tự định nghĩa tên bảng riêng biệt.
 * Kế thừa id, extraData, created_at, updated_at từ lớp nền chung.
 */
export abstract class BaseGoodsReceiptLineEntity
  extends CoreAuditedEntity
  implements IVoucherLine
{
  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Index()
  @Column({ type: 'varchar', length: 128, name: 'item_code', nullable: true })
  itemCode?: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  @Column({ type: 'varchar', length: 50, name: 'unit', default: 'Cái' })
  unit: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty_received' })
  qtyReceived: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'unit_cost',
    default: 0,
  })
  unitCost: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'amount',
    default: 0,
  })
  amount: string;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes?: string;
}
