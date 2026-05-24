import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export type CashflowChannelType = 'CASH' | 'BANK';
export type CashflowFlowDirection = 'INFLOW' | 'OUTFLOW';
export type CashflowPartyScope = 'INTERNAL' | 'EXTERNAL';
export type CashflowStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type CashflowAllocationStatus = 'UNALLOCATED' | 'PARTIAL' | 'FULL';

export const CASHFLOW_BUSINESS_TYPES = {
  CUSTOMER_RECEIPT: 'CUSTOMER_RECEIPT',
  SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
  DEPOSIT_RECEIVED: 'DEPOSIT_RECEIVED',
  DEPOSIT_REFUND: 'DEPOSIT_REFUND',
  EMPLOYEE_ADVANCE: 'EMPLOYEE_ADVANCE',
  ADVANCE_REFUND: 'ADVANCE_REFUND',
  DEBT_SETTLEMENT_RECEIPT: 'DEBT_SETTLEMENT_RECEIPT',
  DEBT_SETTLEMENT_PAYMENT: 'DEBT_SETTLEMENT_PAYMENT',
  INTERNAL_TRANSFER: 'INTERNAL_TRANSFER',
  OTHER_RECEIPT: 'OTHER_RECEIPT',
  OTHER_PAYMENT: 'OTHER_PAYMENT',
} as const;
export type CashflowBusinessType = keyof typeof CASHFLOW_BUSINESS_TYPES;

// Derived rule: business_type -> voucher_family + flow_direction
export const BUSINESS_TYPE_RULES: Record<
  CashflowBusinessType,
  {
    voucher_family: string;
    flow_direction: CashflowFlowDirection;
    party_scope_hint: CashflowPartyScope[];
  }
> = {
  CUSTOMER_RECEIPT: {
    voucher_family: 'STANDARD',
    flow_direction: 'INFLOW',
    party_scope_hint: ['EXTERNAL'],
  },
  SUPPLIER_PAYMENT: {
    voucher_family: 'STANDARD',
    flow_direction: 'OUTFLOW',
    party_scope_hint: ['EXTERNAL'],
  },
  DEPOSIT_RECEIVED: {
    voucher_family: 'ADVANCE',
    flow_direction: 'INFLOW',
    party_scope_hint: ['EXTERNAL'],
  },
  DEPOSIT_REFUND: {
    voucher_family: 'REFUND',
    flow_direction: 'OUTFLOW',
    party_scope_hint: ['EXTERNAL'],
  },
  EMPLOYEE_ADVANCE: {
    voucher_family: 'ADVANCE',
    flow_direction: 'OUTFLOW',
    party_scope_hint: ['INTERNAL'],
  },
  ADVANCE_REFUND: {
    voucher_family: 'REFUND',
    flow_direction: 'INFLOW',
    party_scope_hint: ['INTERNAL'],
  },
  DEBT_SETTLEMENT_RECEIPT: {
    voucher_family: 'SETTLEMENT',
    flow_direction: 'INFLOW',
    party_scope_hint: ['EXTERNAL'],
  },
  DEBT_SETTLEMENT_PAYMENT: {
    voucher_family: 'SETTLEMENT',
    flow_direction: 'OUTFLOW',
    party_scope_hint: ['EXTERNAL'],
  },
  INTERNAL_TRANSFER: {
    voucher_family: 'TRANSFER',
    flow_direction: 'OUTFLOW',
    party_scope_hint: ['INTERNAL', 'EXTERNAL'],
  },
  OTHER_RECEIPT: {
    voucher_family: 'STANDARD',
    flow_direction: 'INFLOW',
    party_scope_hint: ['INTERNAL', 'EXTERNAL'],
  },
  OTHER_PAYMENT: {
    voucher_family: 'STANDARD',
    flow_direction: 'OUTFLOW',
    party_scope_hint: ['INTERNAL', 'EXTERNAL'],
  },
};

export class CreateCashflowVoucherDto {
  @IsString()
  voucher_date!: string;

  @IsString()
  @IsOptional()
  voucher_no?: string;

  @IsUUID()
  branch_id!: string;

  @IsUUID()
  company_id!: string;

  @IsString()
  channel_type!: CashflowChannelType;

  @IsString()
  business_type!: CashflowBusinessType;

  @IsString()
  party_scope!: CashflowPartyScope;

  @IsUUID()
  @IsOptional()
  employee_id?: string;

  @IsString()
  @IsOptional()
  employee_name_snapshot?: string;

  @IsUUID()
  @IsOptional()
  counterparty_id?: string;

  @IsString()
  @IsOptional()
  counterparty_name_snapshot?: string;

  @IsString()
  @IsOptional()
  counterparty_tax_code_snapshot?: string;

  @IsString()
  @IsOptional()
  currency_code?: string;

  @IsNumber()
  @IsOptional()
  exchange_rate?: number;

  @IsNumber()
  amount!: number;

  @IsNumber()
  @IsOptional()
  base_amount?: number;

  @IsUUID()
  @IsOptional()
  cash_fund_id?: string;

  @IsUUID()
  @IsOptional()
  bank_account_id?: string;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  reference_no?: string;

  @IsString()
  @IsOptional()
  external_reference_no?: string;

  @IsString()
  @IsOptional()
  source_module?: string;

  @IsString()
  @IsOptional()
  source_document_type?: string;

  @IsUUID()
  @IsOptional()
  source_document_id?: string;

  @IsUUID()
  @IsOptional()
  legacy_payment_voucher_id?: string;
}
