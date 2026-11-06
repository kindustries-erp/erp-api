import { Entity } from 'typeorm';
import { BaseProcurementOrderAcceptanceEntity } from '@/v2/core/procurement-orders-core/entities/base-procurement-order-acceptance.entity';

@Entity('erp_garage_proc_order_acceptances')
export class GarageProcurementOrderAcceptance extends BaseProcurementOrderAcceptanceEntity {}
