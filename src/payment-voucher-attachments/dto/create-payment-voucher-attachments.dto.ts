import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class CreatePaymentVoucherAttachmentsDto {
  @IsUUID() @IsNotEmpty() payment_voucher_id: string;
  @IsUUID() @IsNotEmpty() file: string;
  @IsOptional() @IsString() attachment_type?: string;
  @IsOptional() @IsString() note?: string;
}
