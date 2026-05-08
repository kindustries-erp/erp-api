import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateBusinessPartnerBankAccountsDto {
  @IsUUID() @IsNotEmpty() business_partner_id: string;
  @IsString() @IsNotEmpty() bank_name: string;
  @IsOptional() @IsString() bank_branch?: string;
  @IsString() @IsNotEmpty() account_number: string;
  @IsString() @IsNotEmpty() account_holder: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;
}
