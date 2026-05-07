import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';

export class CreateVoucherNumberingConfigsDto {
  @IsString() @IsNotEmpty() voucher_type: string;
  @IsString() @IsNotEmpty() prefix: string;
  @IsOptional() @IsString() date_pattern?: string;
  @IsOptional() @IsNumber() current_sequence?: number;
  @IsOptional() @IsNumber() padding_length?: number;
  @IsString() @IsNotEmpty() reset_period: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() note?: string;
}
