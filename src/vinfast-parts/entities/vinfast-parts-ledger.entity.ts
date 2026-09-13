import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VinfastPartsCatalog } from './vinfast-parts-catalog.entity';
import { ErpInvoiceItem } from '../../erp-invoices-core/entities/erp_invoice_item.entity';
import { ErpInvoice } from '../../erp-invoices-core/entities/erp_invoice.entity';

@Entity('vinfast_parts_ledger')
export class VinfastPartsLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'part_sku', length: 32 })
  partSku: string;

  @ManyToOne(() => VinfastPartsCatalog)
  @JoinColumn({ name: 'part_sku', referencedColumnName: 'sku' })
  catalogItem: VinfastPartsCatalog;

  @Column({ name: 'invoice_item_id', type: 'uuid' })
  invoiceItemId: string;

  @ManyToOne(() => ErpInvoiceItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem: ErpInvoiceItem;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => ErpInvoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: ErpInvoice;

  @Column({ length: 3 })
  direction: 'IN' | 'OUT';

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  qty: number;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  unitCost: number | null;

  @Column({
    name: 'pre_vat_amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  preVatAmount: number | null;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: Date;

  @Column({
    type: 'varchar',
    name: 'license_plate',
    length: 32,
    nullable: true,
  })
  licensePlate: string | null;

  @Column({
    type: 'varchar',
    name: 'settlement_order',
    length: 64,
    nullable: true,
  })
  settlementOrder: string | null;

  @Column({ type: 'boolean', name: 'is_adjustment', default: false })
  isAdjustment: boolean;

  @Column({ type: 'int', name: 'adj_sign', default: 1 })
  adjSign: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
