import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpUom } from '../../inventory-core/entities/erp_uom.entity';
import { ErpInventoryItem } from '../../inventory-core/entities/erp_inventory_item.entity';

@Entity({ name: 'erp_bom_lines' })
export class ErpBomLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'bom_id' })
  bomId: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'component_item_id', nullable: true })
  componentItemId: string | null;

  @ManyToOne(() => ErpInventoryItem, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'component_item_id' })
  componentItem: ErpInventoryItem;

  @Column({ type: 'numeric', name: 'qty_required', precision: 18, scale: 3 })
  qtyRequired: string;

  @Column({ type: 'uuid', name: 'uom_id' })
  uomId: string;

  @ManyToOne(() => ErpUom)
  @JoinColumn({ name: 'uom_id' })
  uom: ErpUom;

  @Column({
    type: 'numeric',
    name: 'scrap_rate',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  scrapRate: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
