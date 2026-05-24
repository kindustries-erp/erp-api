import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCashflowVoucherDto } from './create-cashflow-voucher.dto';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class UpdateCashflowVoucherDto extends PartialType(
  OmitType(CreateCashflowVoucherDto, [
    'channel_type',
    'business_type',
  ] as const),
) {}

// Only soft-fields editable after POSTED
export class UpdateSoftFieldsDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsUUID()
  @IsOptional()
  cash_fund_id?: string;

  @IsUUID()
  @IsOptional()
  bank_account_id?: string;
}

export class CancelCashflowVoucherDto {
  @IsString()
  cancel_reason!: string;
}

export class PostCashflowVoucherDto {
  @IsOptional()
  journal_entry?: {
    debit_account_id: string;
    credit_account_id: string;
    note?: string;
  };
}
