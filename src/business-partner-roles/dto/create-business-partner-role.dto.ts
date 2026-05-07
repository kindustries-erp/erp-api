import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreateBusinessPartnerRoleDto {
  @IsUUID()
  @IsNotEmpty()
  business_partner_id: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
