import { IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateCashflowVoucherAttachmentsDto {
  @IsUUID() @IsNotEmpty() cashflow_voucher_id: string;
  @IsUUID() @IsNotEmpty() file: string;
  @IsOptional() @IsString() attachment_type?: string;
  @IsOptional() @IsString() note?: string;
}
