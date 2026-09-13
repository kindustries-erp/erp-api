import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { CreateGoodsReceiptLineDto } from './create-goods-receipt-line.dto';

export class PostGoodsReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ type: () => [CreateGoodsReceiptLineDto] })
  @IsOptional()
  @IsArray()
  lines?: CreateGoodsReceiptLineDto[];
}
