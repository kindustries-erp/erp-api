import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_goods_issue_lines' })
export class ErpGoodsIssueLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'goods_issue_id' })
  goodsIssueId: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'sales_order_line_id', nullable: true })
  salesOrderLineId: string | null;

  @Column({
    type: 'uuid',
    name: 'production_order_material_id',
    nullable: true,
  })
  productionOrderMaterialId: string | null;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'uuid', name: 'serial_id', nullable: true })
  serialId: string | null;

  @Column({ type: 'uuid', name: 'vehicle_id', nullable: true })
  vehicleId: string | null;

  @Column({ type: 'numeric', name: 'qty_issued', precision: 18, scale: 3 })
  qtyIssued: string;

  @Column({
    type: 'numeric',
    name: 'unit_cost',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  unitCost: string | null;

  @Column({
    type: 'numeric',
    name: 'amount',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  amount: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
