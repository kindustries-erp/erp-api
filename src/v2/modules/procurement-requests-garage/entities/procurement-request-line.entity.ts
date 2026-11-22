import { Column, Entity, Index } from 'typeorm';
import { BasePurchaseRequestLineEntity } from '@/v2/core/procurement-requests-core/entities/base-purchase-request-line.entity';

@Entity('proc_request_lines_garage')
export class GarageProcurementRequestLine extends BasePurchaseRequestLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'request_id' })
  requestId: string;
}
