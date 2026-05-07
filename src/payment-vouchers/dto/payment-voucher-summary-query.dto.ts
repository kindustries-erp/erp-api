import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentVoucherSummaryQueryDto {
  @ApiPropertyOptional({
    enum: ['CASH', 'BANK'],
    description: 'Kênh thanh toán',
  })
  @IsOptional()
  @IsString()
  voucher_channel?: string;

  @ApiPropertyOptional({
    enum: ['CASH_RECEIPT', 'CASH_PAYMENT', 'BANK_RECEIPT', 'BANK_PAYMENT'],
    description: 'Loại chứng từ',
  })
  @IsOptional()
  @IsString()
  voucher_type?: string;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'], description: 'Hướng tiền' })
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
    description: 'Trạng thái chứng từ',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'UUID của quỹ tiền mặt' })
  @IsOptional()
  @IsUUID()
  cash_fund_id?: string;

  @ApiPropertyOptional({ description: 'UUID của tài khoản ngân hàng công ty' })
  @IsOptional()
  @IsUUID()
  company_bank_account_id?: string;

  @ApiPropertyOptional({ description: 'UUID của đối tác' })
  @IsOptional()
  @IsUUID()
  counterparty_id?: string;

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

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Ngày chứng từ từ ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  document_date_from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Ngày chứng từ đến ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  document_date_to?: string;
}
