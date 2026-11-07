import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IVoucherLine } from '../contracts/voucher.contract';

/**
 * Abstract Base Entity cho bảng Line chi tiết hàng hóa của chứng từ Nhập kho.
 * KHÔNG gắn @Entity() ở đây để các module con tự định nghĩa tên bảng riêng biệt.
 */
export abstract class BaseGoodsReceiptLineEntity implements IVoucherLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
