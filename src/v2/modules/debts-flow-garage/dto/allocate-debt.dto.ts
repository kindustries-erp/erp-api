import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Phân bổ thủ công vào một khoản nợ (ngoài luồng phiếu thu chi). Header `Idempotency-Key` bắt buộc. */
export class AllocateDebtDto {
  @ApiProperty()
  @IsUUID()
  debtId: string;

  @ApiProperty({ description: 'Số tiền phân bổ, lớn hơn 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    enum: ['MANUAL', 'BANK_TRANSACTION', 'INVOICE_NETOFF'],
  })
  @IsOptional()
  @IsIn(['MANUAL', 'BANK_TRANSACTION', 'INVOICE_NETOFF'])
  sourceType?: 'MANUAL' | 'BANK_TRANSACTION' | 'INVOICE_NETOFF';

  @ApiPropertyOptional({ description: 'Mã chứng từ nguồn' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceId?: string;

  @ApiPropertyOptional({
    description:
      'Phiếu thu chi PAID nguồn tiền; tổng phân bổ không vượt số tiền phiếu',
  })
  @IsOptional()
  @IsUUID()
  voucherId?: string;

  @ApiPropertyOptional({ enum: ['KH', 'BH'] })
  @IsOptional()
  @IsIn(['KH', 'BH'])
  payerType?: 'KH' | 'BH';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  transDate?: string;

  @ApiPropertyOptional({
    description: 'Cho phép thu dư vượt số dư (mặc định từ chối 409)',
  })
  @IsOptional()
  @IsBoolean()
  allowOverpay?: boolean;
}

/** Đổi trạng thái phiếu: duyệt hoặc thu chi. Hủy dùng route riêng `:id/cancel`. */
export class ChangeVoucherStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'PAID'] })
  @IsIn(['APPROVED', 'PAID'])
  status: 'APPROVED' | 'PAID';
}
