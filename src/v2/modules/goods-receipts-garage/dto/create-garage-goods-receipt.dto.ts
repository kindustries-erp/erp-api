import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BaseCreateGoodsReceiptDto } from '@/v2/core/goods-receipts-core/dto/base-create-goods-receipt.dto';
import { CreateGarageGoodsReceiptLineDto } from './create-garage-goods-receipt-line.dto';

export class CreateGarageGoodsReceiptDto extends BaseCreateGoodsReceiptDto {
  @ApiPropertyOptional({ default: 'UNPAID' })
  @IsOptional()
  @IsIn(['UNPAID', 'PARTIALLY_PAID', 'PAID'])
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Đơn mua garage nguồn (nếu có)' })
  @IsOptional()
  @IsUUID()
  garageProcurementOrderId?: string;

  @ApiPropertyOptional({ type: () => [CreateGarageGoodsReceiptLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGarageGoodsReceiptLineDto)
  declare lines?: CreateGarageGoodsReceiptLineDto[];
}
