import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_inventory_adjustment_lines' })
export class ErpInventoryAdjustmentLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'adjustment_id' })
  adjustmentId: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 3,
    name: 'qty_adjusted',
    default: 0,
  })
  qtyAdjusted: string;

  @Column({ type: 'varchar', length: 50, name: 'type_adjust', nullable: true })
  typeAdjust: string | null; // 'increase' | 'decrease'

  @Column({
    type: 'numeric',
    precision: 19,
    scale: 3,
    name: 'unit_cost',
    nullable: true,
  })
  unitCost: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
