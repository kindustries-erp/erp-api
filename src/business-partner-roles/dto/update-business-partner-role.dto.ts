import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class UpdateBusinessPartnerRoleDto {
  @IsOptional()
  @IsUUID()
  business_partner_id?: string;

  @IsOptional()
  @IsString()
  role?: string;

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
