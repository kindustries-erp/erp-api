import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import type { GarageGoodsReceipt } from './garage-goods-receipt.entity';

@Entity('erp_garage_goods_receipt_lines')
export class GarageGoodsReceiptLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'garage_goods_receipt_id' })
  garageGoodsReceiptId: string;

  @ManyToOne('GarageGoodsReceipt', (receipt: any) => receipt.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'garage_goods_receipt_id' })
  receipt?: Relation<GarageGoodsReceipt>;

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
