import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PAYMENT_METHODS = ['CASH', 'BANK', 'EWALLET', 'OTHER'] as const;
export const VOUCHER_DIRECTIONS = ['RECEIPT', 'PAYMENT'] as const;

export class CreatePaymentReceiptDto {
  @ApiPropertyOptional({ description: 'Số phiếu thu (auto-gen nếu bỏ trống)' })
  @IsOptional()
  @IsString()
  voucher_no?: string;

  @ApiProperty({ description: 'ID đối tác (khách hàng)' })
  @IsUUID()
  counterparty_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterparty_name_snapshot?: string;

  @ApiProperty({ description: 'Số tiền thu' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Ngày chứng từ', example: '2026-05-11' })
  @IsDateString()
  document_date!: string;

  @ApiPropertyOptional({
    description: 'Ngày hạch toán (mặc định = document_date)',
  })
  @IsOptional()
  @IsDateString()
  posting_date?: string;

  @ApiProperty({ enum: PAYMENT_METHODS, description: 'Phương thức thu' })
  @IsIn(PAYMENT_METHODS)
  payment_method!: string;

  @ApiPropertyOptional({
    description:
      'ID TK tiền (111/112/113) — auto-map từ payment_method nếu bỏ trống',
  })
  @IsOptional()
  @IsUUID()
  debit_account_id?: string;

  @ApiPropertyOptional({ description: 'ID TK công nợ AR (131) — auto-default' })
  @IsOptional()
  @IsUUID()
  credit_account_id?: string;

  @ApiPropertyOptional({ description: 'Mô tả' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Danh sách invoice cần allocate ngay khi tạo',
    type: [Object],
    example: [
      { target_document_id: 'uuid', amount: 1000000, writeoff_amount: 0 },
    ],
  })
  @IsOptional()
  allocations?: {
    target_document_id: string;
    amount: number;
    writeoff_amount?: number;
    writeoff_account_id?: string;
    reason?: string;
  }[];
}
