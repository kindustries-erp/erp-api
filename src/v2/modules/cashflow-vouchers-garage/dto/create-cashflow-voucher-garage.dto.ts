import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const GARAGE_VOUCHER_TYPES = ['RECEIPT', 'PAYMENT'] as const;
export const GARAGE_VOUCHER_STATUSES = [
  'EXPECTED',
  'PENDING',
  'APPROVED',
  'PAID',
  'CANCELLED',
] as const;
export const GARAGE_PAYER_TYPES = ['KH', 'BH'] as const;

/** Tạo phiếu thu chi garage. Mọi trường đều whitelist; không nhận `branch`, `source`, `createdBy` từ client. */
export class CreateCashflowVoucherGarageDto {
  @ApiProperty({ enum: GARAGE_VOUCHER_TYPES })
  @IsIn(GARAGE_VOUCHER_TYPES)
  voucherType: 'RECEIPT' | 'PAYMENT';

  @ApiProperty({ description: 'Số tiền, lớn hơn 0' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Ngày thu chi (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  transDate: string;

  @ApiPropertyOptional({ description: 'Bỏ trống để sinh mã tự động' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  voucherCode?: string;

  @ApiPropertyOptional({ enum: GARAGE_VOUCHER_STATUSES })
  @IsOptional()
  @IsIn(GARAGE_VOUCHER_STATUSES)
  status?: (typeof GARAGE_VOUCHER_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licensePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  partnerName?: string;

  @ApiPropertyOptional({
    enum: GARAGE_PAYER_TYPES,
    description: 'Bên trả: KH hoặc BH',
  })
  @IsOptional()
  @IsIn(GARAGE_PAYER_TYPES)
  payerType?: 'KH' | 'BH';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** Sửa phiếu còn nháp: không đổi loại phiếu, mã, trạng thái (trạng thái đổi qua lệnh riêng). */
export class UpdateCashflowVoucherGarageDto extends PartialType(
  OmitType(CreateCashflowVoucherGarageDto, [
    'voucherType',
    'voucherCode',
    'status',
  ] as const),
) {}
