import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

import { ErpBusinessPartner } from '../../business-partners-core/entities/erp_business_partner.entity';
import { ErpPurchaseOrderLine } from './erp_purchase_order_line.entity';

@Entity({ name: 'erp_purchase_orders' })
export class ErpPurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'po_no' })
  poNo: string;

  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => ErpBusinessPartner)
  @JoinColumn({ name: 'supplier_id' })
  supplier?: ErpBusinessPartner;

  @Column({ type: 'timestamptz', name: 'order_date' })
  orderDate: string;

  @Column({ type: 'timestamptz', name: 'expected_date', nullable: true })
  expectedDate: string | null;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'payment_status',
    default: 'UNPAID',
  })
  paymentStatus: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'supplier_invoice_no',
    nullable: true,
  })
  supplierInvoiceNo: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ErpPurchaseOrderLine, (line) => line.purchaseOrder)
  lines?: ErpPurchaseOrderLine[];
}
