import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator';

export class CreateOpeningBalancesDto {
  @IsString() @IsNotEmpty() fiscal_period: string;
  @IsString() @IsNotEmpty() balance_date: string;
  @IsUUID() @IsNotEmpty() account_id: string;
  @IsOptional() @IsUUID() cash_fund_id?: string;
  @IsOptional() @IsUUID() company_bank_account_id?: string;
  @IsOptional() @IsNumber() debit_amount?: number;
  @IsOptional() @IsNumber() credit_amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
