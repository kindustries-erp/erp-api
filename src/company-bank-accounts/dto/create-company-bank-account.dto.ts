import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateCompanyBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bank_account_code: string;

  @IsString()
  @IsNotEmpty()
  bank_name: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsNotEmpty()
  account_holder: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsUUID()
  @IsNotEmpty()
  accounting_account_id: string;

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
