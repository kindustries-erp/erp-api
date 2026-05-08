import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateBusinessPartnerContactsDto {
  @IsUUID() @IsNotEmpty() business_partner_id: string;
  @IsString() @IsNotEmpty() full_name: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() identity_no?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() is_default_receiver?: boolean;
  @IsOptional() @IsBoolean() is_default_payer?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;
}
