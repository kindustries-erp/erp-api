import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JournalEntryLineDto {
  @ApiProperty({ description: 'UUID của tài khoản kế toán' })
  @IsNotEmpty()
  @IsString()
  account_id: string;

  @ApiProperty({ description: 'Số tiền nợ (debit)', default: 0 })
  @IsNumber()
  @Min(0)
  debit: number;

  @ApiProperty({ description: 'Số tiền có (credit)', default: 0 })
  @IsNumber()
  @Min(0)
  credit: number;

  @ApiPropertyOptional({ description: 'Diễn giải dòng bút toán' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị' })
  @IsOptional()
  @IsNumber()
  sort?: number;
}

export class CreateJournalEntryDto {
  @ApiPropertyOptional({
    description: 'Số chứng từ (để trống = auto-generate)',
  })
  @IsOptional()
  @IsString()
  voucher_no?: string;

  @ApiProperty({ description: 'Ngày chứng từ', example: '2026-01-15' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'UUID kỳ kế toán' })
  @IsOptional()
  @IsString()
  period_id?: string;

  @ApiPropertyOptional({ description: 'Diễn giải bút toán' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Loại chứng từ gốc (payment_voucher, invoice, ...)',
  })
  @IsOptional()
  @IsString()
  reference_type?: string;

  @ApiPropertyOptional({ description: 'UUID chứng từ gốc' })
  @IsOptional()
  @IsString()
  reference_id?: string;

  @ApiProperty({
    description:
      'Danh sách dòng bút toán (tối thiểu 2 dòng, tổng debit = tổng credit)',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines: JournalEntryLineDto[];
}
