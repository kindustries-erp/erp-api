import { Column, Entity, Index } from 'typeorm';
import { BasePurchaseRequestLineEntity } from '@/v2/core/procurement-requests/entities/base-purchase-request-line.entity';

@Entity('erp_proc_request_lines')
export class ProcurementRequestLine extends BasePurchaseRequestLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'request_id' })
  requestId: string;
}
