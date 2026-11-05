import { Entity } from 'typeorm';
import { BaseProcurementOrderAcceptanceEntity } from '@/v2/core/procurement-orders/entities/base-procurement-order-acceptance.entity';

@Entity('erp_proc_order_acceptances')
export class ProcurementOrderAcceptance extends BaseProcurementOrderAcceptanceEntity {}
