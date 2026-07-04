import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_production_orders' })
export class ErpProductionOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'reference_no' })
  referenceNo: string;

  @Column({ type: 'uuid', name: 'finished_good_item_id' })
  finishedGoodItemId: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty_to_produce' })
  qtyToProduce: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_produced',
    default: 0,
  })
  qtyProduced: string;

  @Column({ type: 'date', name: 'planned_start_date', nullable: true })
  plannedStartDate: string | null;

  @Column({ type: 'date', name: 'planned_end_date', nullable: true })
  plannedEndDate: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'warehouse_code',
    nullable: true,
  })
  warehouseCode: string | null;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'POSTED' })
  status: string;

  @Column({ type: 'jsonb', name: 'output_metadata', nullable: true })
  outputMetadata: Record<string, any> | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
