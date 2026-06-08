import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'erp_production_order_materials' })
export class ErpProductionOrderMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_order_id' })
  productionOrderId: string;

  @Column({ type: 'uuid', name: 'item_id' })
  itemId: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty_required' })
  qtyRequired: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'unit_cost',
    nullable: true,
  })
  unitCost: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'amount',
    nullable: true,
  })
  amount: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
