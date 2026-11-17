import { Entity, Index } from 'typeorm';
import { BaseCashflowVoucherEntity } from '@/v2/core/cashflow-vouchers-core/entities/base-cashflow-voucher.entity';

/** Phiếu thu chi garage (v2). Phân bổ vào công nợ đi qua orchestrator `debts-flow-garage`. */
@Entity('cashflow_vouchers_garage')
@Index('IDX_cashflow_vouchers_garage_branch_date', [
  'branchExternalId',
  'transDate',
])
export class CashflowVoucherGarage extends BaseCashflowVoucherEntity {}
