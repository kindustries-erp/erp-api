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
import { CreateGarageGoodsReceiptLineDto } from './create-garage-goods-receipt-line.dto';

export class CreateGarageGoodsReceiptDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

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

  @ApiPropertyOptional({ default: 'UNPAID' })
  @IsOptional()
  @IsIn(['UNPAID', 'PARTIALLY_PAID', 'PAID'])
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ type: [CreateGarageGoodsReceiptLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGarageGoodsReceiptLineDto)
  lines?: CreateGarageGoodsReceiptLineDto[];
}
