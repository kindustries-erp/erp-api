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

export const CUSTOMER_ADVANCE_PAYMENT_METHODS = ['CASH', 'BANK', 'EWALLET'] as const;

export class CreateCustomerAdvanceDto {
  @ApiPropertyOptional({ description: 'Số phiếu đặt cọc (auto-gen nếu bỏ trống)' })
  @IsOptional()
  @IsString()
  voucher_no?: string;

  @ApiProperty({ description: 'ID khách hàng' })
  @IsUUID()
  counterparty_id!: string;

  @ApiPropertyOptional({ description: 'Tên khách hàng snapshot (auto-fill nếu bỏ trống)' })
  @IsOptional()
  @IsString()
  counterparty_name_snapshot?: string;

  @ApiProperty({ description: 'Số tiền khách đặt cọc' })
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

  @ApiPropertyOptional({ description: 'Ngày hạch toán (mặc định = document_date)' })
  @IsOptional()
  @IsDateString()
  posting_date?: string;

  @ApiProperty({ enum: CUSTOMER_ADVANCE_PAYMENT_METHODS, description: 'Phương thức thu cọc' })
  @IsIn(CUSTOMER_ADVANCE_PAYMENT_METHODS)
  payment_method!: string;

  @ApiPropertyOptional({ description: 'ID TK tiền (111/112/113) — auto-map từ payment_method nếu bỏ trống' })
  @IsOptional()
  @IsUUID()
  debit_account_id?: string;

  @ApiPropertyOptional({ description: 'ID TK 131 advance — auto-default 131 nếu bỏ trống' })
  @IsOptional()
  @IsUUID()
  credit_account_id?: string;

  @ApiPropertyOptional({ description: 'Mô tả' })
  @IsOptional()
  @IsString()
  description?: string;
}
