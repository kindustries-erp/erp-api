import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAccountingConfigsCoreDto {
  @IsString()
  @IsNotEmpty()
  module: string;

  @IsUUID()
  @IsOptional()
  debit_account_id?: string;

  @IsUUID()
  @IsOptional()
  credit_account_id?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}
