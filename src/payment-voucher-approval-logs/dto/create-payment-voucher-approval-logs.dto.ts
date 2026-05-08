import { IsString, IsOptional, IsUUID, IsNotEmpty } from 'class-validator';

export class CreatePaymentVoucherApprovalLogsDto {
  @IsUUID() @IsNotEmpty() payment_voucher_id: string;
  @IsString() @IsNotEmpty() action: string;
  @IsOptional() @IsUUID() action_by?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() from_status?: string;
  @IsOptional() @IsString() to_status?: string;
}
