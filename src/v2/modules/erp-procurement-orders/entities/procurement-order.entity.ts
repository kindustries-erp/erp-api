import { Entity } from 'typeorm';
import { BaseProcurementOrderEntity } from '@/v2/core/procurement-orders/entities/base-procurement-order.entity';

@Entity('erp_proc_orders')
export class ProcurementOrder extends BaseProcurementOrderEntity {}
