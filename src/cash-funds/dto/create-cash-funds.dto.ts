import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateCashFundsDto {
  @IsString() @IsNotEmpty() fund_code: string;
  @IsString() @IsNotEmpty() fund_name: string;
  @IsOptional() @IsString() currency?: string;
  @IsUUID() @IsNotEmpty() accounting_account_id: string;
  @IsOptional() @IsUUID() responsible_user_id?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;
}
