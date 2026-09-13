import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpInventoryItem } from './erp_inventory_item.entity';

@Entity({ name: 'erp_inventory_tracking_lots' })
export class ErpInventoryTrackingLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @ManyToOne(() => ErpInventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: ErpInventoryItem;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'lot_code',
  })
  lotCode: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'received_qty',
    default: 0,
  })
  receivedQty: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'issued_qty',
    default: 0,
  })
  issuedQty: string;

  @Column({ type: 'date', name: 'expiry_date', nullable: true })
  expiryDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
