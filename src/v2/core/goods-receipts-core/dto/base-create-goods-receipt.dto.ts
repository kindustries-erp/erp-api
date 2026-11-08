import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ExtraDataField } from '../../base-core/dto/extra-data.decorator';
import { BaseCreateGoodsReceiptLineDto } from './base-create-goods-receipt-line.dto';

export class BaseCreateGoodsReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptNo?: string;

  @ApiProperty()
  @IsDateString()
  receiptDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Chi nhánh (null = bỏ trống)',
  })
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional({ default: 'DRAFT' })
  @IsOptional()
  @IsIn(['DRAFT', 'POSTED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ExtraDataField()
  extraData?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => [BaseCreateGoodsReceiptLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseCreateGoodsReceiptLineDto)
  lines?: BaseCreateGoodsReceiptLineDto[];
}
