import { Column, Entity, Index } from 'typeorm';
import { BaseProcurementOrderEntity } from '@/v2/core/procurement-orders/entities/base-procurement-order.entity';

@Entity('erp_garage_proc_orders')
export class GarageProcurementOrder extends BaseProcurementOrderEntity {
  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'branch_name', nullable: true })
  branchName: string | null;

  /** Trạng thái thanh toán: chỉ lưu, luồng DNTT sẽ ghi sau. */
  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_status',
    default: 'UNPAID',
  })
  paymentStatus: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'supplier_invoice_no',
    nullable: true,
  })
  supplierInvoiceNo: string | null;
}
