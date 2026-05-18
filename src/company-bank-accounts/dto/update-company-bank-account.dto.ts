import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class UpdateCompanyBankAccountDto {
  @IsOptional()
  @IsString()
  bank_account_code?: string;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  account_number?: string;

  @IsOptional()
  @IsString()
  account_holder?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  accounting_account_id?: string;

  @IsOptional()
  @IsUUID()
  responsible_user_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
