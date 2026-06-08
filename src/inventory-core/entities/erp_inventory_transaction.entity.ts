import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'erp_inventory_transactions' })
export class ErpInventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'transaction_type' })
  transactionType: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'document_type',
    nullable: true,
  })
  documentType: string | null;

  @Column({ type: 'uuid', name: 'document_id', nullable: true })
  documentId: string | null;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'warehouse_code',
    nullable: true,
  })
  warehouseCode: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_in',
    default: 0,
  })
  qtyIn: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_out',
    default: 0,
  })
  qtyOut: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'unit_cost',
    nullable: true,
  })
  unitCost: string | null;

  @Column({ type: 'date', name: 'transaction_date' })
  transactionDate: string;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
