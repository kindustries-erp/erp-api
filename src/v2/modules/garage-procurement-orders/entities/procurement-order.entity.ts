import { Column, Entity, Index } from 'typeorm';
import { BaseProcurementOrderEntity } from '@/v2/core/procurement-orders/entities/base-procurement-order.entity';

@Entity('erp_garage_proc_orders')
export class GarageProcurementOrder extends BaseProcurementOrderEntity {
  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'branch_name', nullable: true })
  branchName: string | null;
}
