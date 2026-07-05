import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActivateWarrantyDto {
  @IsString()
  @IsNotEmpty()
  sokhung: string;

  @IsString()
  @IsNotEmpty()
  somay: string;

  @IsString()
  @IsNotEmpty()
  dealer_id: string;

  @IsString()
  @IsNotEmpty()
  dealer_name: string;

  @IsString()
  @IsNotEmpty()
  customer_name: string;

  @IsString()
  @IsNotEmpty()
  customer_address: string;

  @IsString()
  @IsNotEmpty()
  customer_phone: string;

  @IsOptional()
  @IsString()
  customer_dob?: string;

  @IsOptional()
  @IsString()
  customer_email?: string;
}
