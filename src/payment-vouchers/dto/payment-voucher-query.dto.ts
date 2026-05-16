import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentVoucherQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['CASH', 'BANK'] })
  @IsOptional()
  @IsString()
  voucher_channel?: string;

  @ApiPropertyOptional({
    enum: ['CASH_RECEIPT', 'CASH_PAYMENT', 'BANK_RECEIPT', 'BANK_PAYMENT'],
  })
  @IsOptional()
  @IsString()
  voucher_type?: string;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsString()
  voucher_direction?: string;

  @ApiPropertyOptional({
    enum: [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'POSTED',
      'REJECTED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['INTERNAL', 'EXTERNAL'] })
  @IsOptional()
  @IsString()
  counterparty_source?: string;

  @ApiPropertyOptional({ description: 'UUID of counterparty' })
  @IsOptional()
  @IsString()
  counterparty_id?: string;

  @ApiPropertyOptional({ description: 'UUID of employee (INTERNAL vouchers)' })
  @IsOptional()
  @IsString()
  employee_id?: string;

  @ApiPropertyOptional({ description: 'UUID chi nhánh (branch)' })
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Ngày hạch toán từ ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  posting_date_from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Ngày hạch toán đến ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  posting_date_to?: string;

  @ApiPropertyOptional({ description: 'Số tiền chính xác' })
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ description: 'Số tiền tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  amount_min?: number;

  @ApiPropertyOptional({ description: 'Số tiền tối đa' })
  @IsOptional()
  @Type(() => Number)
  amount_max?: number;
}
