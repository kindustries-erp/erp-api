import { Column, Entity, Index } from 'typeorm';
import { BasePurchaseRequestEntity } from '@/v2/core/procurement-requests-core/entities/base-purchase-request.entity';

@Entity('erp_garage_proc_requests')
export class GarageProcurementRequest extends BasePurchaseRequestEntity {
  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'branch_name', nullable: true })
  branchName: string | null;
}
