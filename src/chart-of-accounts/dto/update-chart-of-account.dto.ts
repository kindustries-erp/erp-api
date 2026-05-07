import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsIn,
} from 'class-validator';

export class UpdateChartOfAccountDto {
  @IsOptional()
  @IsString()
  account_code?: string;

  @IsOptional()
  @IsString()
  account_name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'OTHER'])
  account_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DEBIT', 'CREDIT'])
  normal_balance?: string;

  @IsOptional()
  @IsUUID()
  parent_account_id?: string;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @IsBoolean()
  is_cash_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_bank_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_receivable_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_payable_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_advance_account?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
