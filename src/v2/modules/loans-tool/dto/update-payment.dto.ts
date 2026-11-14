import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePaymentDto {
  @ApiPropertyOptional({ description: 'Kỳ thanh toán (1, 2, ...)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  periodNumber?: number;

  @ApiPropertyOptional({
    description: 'Ngày thực tế thanh toán (YYYY-MM-DD)',
    example: '2026-11-15',
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Số tiền gốc đã trả', example: 5000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  principalPaid?: number;

  @ApiPropertyOptional({ description: 'Số tiền lãi đã trả', example: 1250000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestPaid?: number;

  @ApiPropertyOptional({
    description: 'Mã tham chiếu / Ủy nhiệm chi ngân hàng',
    example: 'FT241115-0987',
  })
  @IsOptional()
  @IsString()
  paymentRef?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú bổ sung',
    example: 'Đã cập nhật số tiền thực tế',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
