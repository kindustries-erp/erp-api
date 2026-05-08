import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateBusinessPartnersDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() display_name?: string;
  @IsString() @IsNotEmpty() partner_kind: string;
  @IsOptional() @IsString() tax_code?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() ward?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;
}
