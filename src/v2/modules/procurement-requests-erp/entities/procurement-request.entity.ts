import { Entity } from 'typeorm';
import { BasePurchaseRequestEntity } from '@/v2/core/procurement-requests-core/entities/base-purchase-request.entity';

@Entity('erp_proc_requests')
export class ProcurementRequest extends BasePurchaseRequestEntity {}
