import { Entity } from 'typeorm';
import { BaseProcurementOrderAcceptanceEntity } from '@/v2/core/procurement-orders-core/entities/base-procurement-order-acceptance.entity';

@Entity('proc_order_acceptances_garage')
export class GarageProcurementOrderAcceptance extends BaseProcurementOrderAcceptanceEntity {}
